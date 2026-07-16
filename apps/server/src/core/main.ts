import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
import fastify from 'fastify';
import { existsSync } from 'fs';
import { join } from 'path';
import { registerAllApis } from '../apis';
import { register as registerDocsApi } from '../apis/docs-api';
import { initializeFolders } from '../tools/initializer';
import { getArgv } from './argv/argv';
import { RATE_LIMIT_EXCLUDED_PATHS } from './constants/rate-limit-const';
import { initializeDatabase } from './database/database';
import { hasSqlMigrations, runMigrations } from './database/migrations';
import { debugLog, errorLog, infoLog } from './logger';
import { SERVER_MAX_PARAM_LENGTH } from './main-const';
import { validateEnvironment } from './utils/environment-util';

export const main = async () => {
  try {
    const { dataFolder } = getArgv();

    if (!existsSync(`${dataFolder}/.env`)) throw new Error(`.env file not found in ${dataFolder}. Please create it.`);

    dotenv.config({ path: `${dataFolder}/.env`, override: true });
    validateEnvironment();

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

    const app = fastify({
      trustProxy: '127.0.0.1',
      bodyLimit: 50 * 1024 * 1024,
      routerOptions: { maxParamLength: SERVER_MAX_PARAM_LENGTH },
    });
    debugLog('Initializing fastify server');

    // Registered before global middleware so helmet's CSP does not block Swagger UI assets.
    await registerDocsApi(app);

    app.addHook('onRequest', async (request) => {
      debugLog(`Incoming request: ${request.url}`);
    });
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
    const rateLimitValue = process.env.RATE_LIMIT !== undefined ? Number(process.env.RATE_LIMIT) : 120;
    await app.register(fastifyRateLimit, {
      max: rateLimitValue,
      timeWindow: 60 * 1000,
      enableDraftSpec: true,
      allowList: (request) => RATE_LIMIT_EXCLUDED_PATHS.includes(request.routeOptions.url ?? request.url),
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
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Server start unknown error (${error.message})`);
    process.exit(1);
  }
};
