import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'fs';
import helmet from 'helmet';
import nocache from 'nocache';
import { registerAllApis } from '../apis';
import { register as registerDocsApi } from '../apis/docs-api';
import { initializeFolders } from '../tools/initializer';
import { getArgv } from './argv/argv';
import { debugLog, errorLog, infoLog } from './logger';
import { initializeDatabase } from './database/database';
import { runMigrations } from './database/migrations';
import { join } from 'path';
import { RATE_LIMIT_EXCLUDED_PATHS } from './constants/rate-limit-const';
import { getRateLimitKey } from './utils/rate-limit-util';

export const main = async () => {
  try {
    const { dataFolder } = getArgv();

    if (!existsSync(`${dataFolder}/.env`)) throw new Error(`.env file not found in ${dataFolder}. Please create it.`);

    dotenv.config({ path: `${dataFolder}/.env`, override: true });

    if (!process.env.OMDB_API_KEY?.trim()) throw new Error('OMDB_API_KEY is not set. Please add it to your .env file.');

    initializeFolders(dataFolder);

    const db = initializeDatabase(dataFolder);
    const possibleMigrationDirs = [
      join(__dirname, '..', 'migrations'),
      join(__dirname, '..', '..', 'migrations'),
      join(__dirname, 'migrations'),
      join(process.cwd(), 'migrations'),
      join(process.cwd(), 'apps', 'server', 'src', 'migrations'),
    ];
    const migrationsDir = possibleMigrationDirs.find((dir) => existsSync(dir));
    if (migrationsDir) {
      runMigrations(db, migrationsDir);
    } else {
      throw new Error('Could not find migrations directory. Database schema may not be up to date.');
    }

    const app = express();
    app.set('trust proxy', 1);
    debugLog('Initializing express server');

    // Registered before global middleware so helmet's CSP does not block Swagger UI assets.
    registerDocsApi(app);

    app.use((request, _response, next) => {
      debugLog(`Incoming request: ${request.url}`);
      next();
    });
    debugLog('Applying request logging middleware');
    app.use(helmet());
    debugLog('Applying security middleware');
    app.use(nocache());
    debugLog('Applying no-cache middleware');
    const rateLimitValue = process.env.RATE_LIMIT !== undefined ? Number(process.env.RATE_LIMIT) : 100;
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: rateLimitValue,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        skip: (request) => RATE_LIMIT_EXCLUDED_PATHS.includes(request.path),
        keyGenerator: getRateLimitKey,
      })
    );
    debugLog('Applying rate limiting middleware');
    app.use(
      cors({
        origin: (requestOrigin: string | undefined, callback: (err: Error | null, origin?: boolean) => void): void => {
          if (process.env.CORS_ORIGIN === requestOrigin || process.env.CORS_ORIGIN === '*') callback(null, true);
          else callback(new Error(`Not allowed by CORS (invalid origin: ${requestOrigin})`), false);
        },
        optionsSuccessStatus: 200,
      })
    );
    debugLog('Applying CORS middleware');

    app.use(bodyParser.json({ limit: '50mb', strict: false }));
    app.use(bodyParser.urlencoded({ extended: true }));
    debugLog('Applying body parser middleware');
    app.use(cookieParser(process.env.COOKIE_SECRET));
    debugLog('Applying cookie parser middleware');

    registerAllApis(app);

    app.listen(Number(process.env.PORT), `${process.env.HOST}`, () => {
      infoLog(`[ ready ] http://${process.env.HOST}:${process.env.PORT}`);
    });
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Server start unknown error (${error.message})`);
    process.exit(1);
  }
};
