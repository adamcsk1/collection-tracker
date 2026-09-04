import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import fastify, { type FastifyRequest } from 'fastify';
import { existsSync } from 'fs';
import { join } from 'path';
import { registerAllApis } from '../apis';
import { register as registerDocsApi } from '../apis/docs-api';
import { initializeFolders } from '../tools/initializer';
import { getArgv } from './argv/argv';
import { getGlobalRateLimit } from './utils/rate-limit-util';
import { initializeDatabase } from './database/database';
import { hasSqlMigrations, runMigrations } from './database/migrations';
import { debugLog, errorLog, infoLog } from './logger';
import { SERVER_MAX_PARAM_LENGTH } from './main-const';
import { apiResponseHook } from './utils/api-response-util';
import { validateEnvironment } from './utils/environment-util';
import { getRequestPath } from './utils/request-url-util';
import { warmBackgroundImages } from './background/background';
import { loadExternalMetadataProviders } from './external-metadata/external-metadata-provider-factory';

const DEFAULT_METADATA_SERVICE_READY_ATTEMPTS = 30;
const DEFAULT_METADATA_SERVICE_READY_DELAY_MS = 1_000;

export const logIncomingRequest = async (request: Pick<FastifyRequest, 'url'>): Promise<void> => {
  await debugLog(`Incoming request: ${getRequestPath(request.url)}`);
};

const waitForMetadataService = async (): Promise<void> => {
  const parsedAttempts = Number(process.env.METADATA_SERVICE_READY_ATTEMPTS);
  const parsedDelayMs = Number(process.env.METADATA_SERVICE_READY_DELAY_MS);
  const attempts =
    Number.isInteger(parsedAttempts) && parsedAttempts > 0 ? parsedAttempts : DEFAULT_METADATA_SERVICE_READY_ATTEMPTS;
  const delayMs =
    Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0 ? parsedDelayMs : DEFAULT_METADATA_SERVICE_READY_DELAY_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await loadExternalMetadataProviders();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('metadata service is unavailable');
};

export const main = async () => {
  try {
    const { dataFolder } = getArgv();

    if (!existsSync(`${dataFolder}/.env`)) throw new Error(`.env file not found in ${dataFolder}. Please create it.`);

    dotenv.config({ path: `${dataFolder}/.env`, override: true });
    validateEnvironment();
    await waitForMetadataService();

    initializeFolders(dataFolder);

    const db = initializeDatabase(dataFolder);
    const possibleMigrationDirs = [
      join(__dirname, '..', 'migrations'),
      join(__dirname, '..', '..', 'migrations'),
      join(__dirname, 'migrations'),
      join(process.cwd(), 'migrations'),
      join(process.cwd(), 'apps', 'server', 'src', 'migrations'),
    ];
    const migrationsDir = possibleMigrationDirs.find((dir) => existsSync(dir) && hasSqlMigrations(dir));
    if (migrationsDir) {
      await runMigrations(db, migrationsDir);
    } else {
      throw new Error('Could not find migrations directory. Database schema may not be up to date.');
    }

    let trustProxy: string | string[] | boolean = '127.0.0.1';
    if (process.env.TRUSTED_PROXY_CIDRS) {
      const proxies = process.env.TRUSTED_PROXY_CIDRS.split(',')
        .map((proxy) => proxy.trim())
        .filter(Boolean);
      if (proxies.length > 0) {
        trustProxy = ['127.0.0.1', ...proxies];
      }
    }

    const app = fastify({
      trustProxy,
      bodyLimit: 50 * 1024 * 1024,
      routerOptions: { maxParamLength: SERVER_MAX_PARAM_LENGTH },
    });
    debugLog('Initializing fastify server');

    // Registered before global middleware so helmet's CSP does not block Swagger UI assets.
    await registerDocsApi(app);

    app.addHook('onRequest', logIncomingRequest);
    app.addHook('onSend', apiResponseHook);
    debugLog('Applying request logging middleware');
    await app.register(fastifyHelmet);
    debugLog('Applying security middleware');
    app.addHook('onSend', async (_request, response) => {
      response.header('Surrogate-Control', 'no-store');
      response.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.header('Pragma', 'no-cache');
      response.header('Expires', '0');
    });
    debugLog('Applying no-cache middleware');
    await app.register(fastifyRateLimit, {
      max: getGlobalRateLimit(),
      timeWindow: 60 * 1000,
      enableDraftSpec: true,
    });
    debugLog('Applying rate limiting middleware');
    await app.register(fastifyCors, {
      origin: (requestOrigin, callback) => {
        if (process.env.CORS_ORIGIN === requestOrigin || process.env.CORS_ORIGIN === '*') callback(null, true);
        else callback(new Error(`Not allowed by CORS (invalid origin: ${requestOrigin})`), false);
      },
      optionsSuccessStatus: 200,
    });
    debugLog('Applying CORS middleware');

    await app.register(fastifyFormbody);
    debugLog('Applying body parser middleware');
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
    debugLog('Applying cookie parser middleware');

    registerAllApis(app);

    await app.listen({ port: Number(process.env.PORT), host: `${process.env.HOST}` });
    infoLog(`[ ready ] http://${process.env.HOST}:${process.env.PORT}`);
    void warmBackgroundImages();
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Server start unknown error (${error.message})`);
    process.exit(1);
  }
};
