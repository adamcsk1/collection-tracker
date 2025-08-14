import '@server/apis';
import { getArgv } from '@server/core/argv/argv';
import { errorLog, infoLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { initializeFolders } from '@server/tools/initializer';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { existsSync, readFileSync } from 'fs';
import helmet from 'helmet';

export const main = () => {
  try {
    const { dataFolder } = getArgv();
    Store.set('dataFolder', dataFolder);

    if (!existsSync(`${dataFolder}/.env`)) throw new Error(`.env file not found in ${dataFolder}. Please create it.`);

    dotenv.config({ path: `${dataFolder}/.env`, override: true });

    initializeFolders();

    Store.set(
      'users',
      JSON.parse(
        readFileSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`, 'utf-8')
      )
    );

    const app = express();

    app.use(helmet());
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 100,
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
    app.use(
      cors({
        origin: (requestOrigin: string | undefined, callback: (err: Error | null, origin?: boolean) => void): void => {
          if (process.env.CORS_ORIGIN === requestOrigin || process.env.CORS_ORIGIN === '*') callback(null, true);
          else callback(new Error(`Not allowed by CORS (invalid origin: ${requestOrigin})`), false);
        },
        optionsSuccessStatus: 200,
      })
    );
    app.set('trust proxy', 1);
    app.use(bodyParser.json({ limit: '50mb', strict: false }));
    app.use(bodyParser.urlencoded({ extended: true }));

    Store.set('app', app);

    app.listen(Number(process.env.PORT), process.env.HOST, () => {
      infoLog(`[ ready ] http://${process.env.HOST}:${process.env.PORT}`);
    });
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Server start unknown error (${error.message})`);
    process.exit(1);
  }
};
