import { registerAllApis } from '../apis';
import { getArgv } from './argv/argv';
import { debugLog, errorLog, infoLog } from './logger';
import { DATABASE_FILES, FOLDERS } from './main-const';
import { Store } from './store/store';
import { initializeFileHashes } from './utils/hash-util';
import { initializeFolders } from '../tools/initializer';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { existsSync, readFileSync } from 'fs';
import helmet from 'helmet';
import nocache from 'nocache';

export const main = async () => {
  try {
    const { dataFolder } = getArgv();
    Store.set('dataFolder', dataFolder);

    if (!existsSync(`${dataFolder}/.env`)) throw new Error(`.env file not found in ${dataFolder}. Please create it.`);

    dotenv.config({ path: `${dataFolder}/.env`, override: true });

    if (!process.env.OMDB_API_KEY?.trim()) throw new Error('OMDB_API_KEY is not set. Please add it to your .env file.');

    initializeFolders();
    await initializeFileHashes();

    Store.set(
      'users',
      JSON.parse(
        readFileSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`, 'utf-8')
      )
    );
    Store.set(
      'parserConfigs',
      JSON.parse(
        readFileSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.parserConfigs}`, 'utf-8')
      )
    );
    Store.set(
      'tagConfigs',
      JSON.parse(
        readFileSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.tagConfigs}`, 'utf-8')
      )
    );
    Store.set(
      'userSettings',
      JSON.parse(
        readFileSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.userSettings}`, 'utf-8')
      )
    );

    const app = express();
    app.set('trust proxy', 1);
    debugLog('Initializing express server');

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
        keyGenerator: (request: express.Request): string => {
          if (!request.ip) {
            errorLog('request.ip is missing!');
            return ipKeyGenerator(request.socket.remoteAddress);
          }

          return ipKeyGenerator(request.ip.replace(/:\d+[^:]*$/, ''));
        },
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

    app.listen(Number(process.env.PORT), process.env.HOST, () => {
      infoLog(`[ ready ] http://${process.env.HOST}:${process.env.PORT}`);
    });
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Server start unknown error (${error.message})`);
    process.exit(1);
  }
};
