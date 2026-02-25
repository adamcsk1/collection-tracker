import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { GetAllApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { readdirSync, readFileSync } from 'fs';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/get-all`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const limit = Number(request.query.limit) || 10;
      const offset = Number(request.query.offset) || 0;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;
      const cache = Store.getLastValue('cache');
      const files = readdirSync(storeFolder)
        .sort((a, b) => -a.localeCompare(b))
        .slice(offset, offset + limit);

      const result: GetAllApiResponseModel = [];
      for (const file of files) {
        const cacheKey = `${request.usernameHash}-${file}`;
        if (!!cache[cacheKey]) result.push({ name: file, content: cache[cacheKey] });
        else {
          const content = readFileSync(`${storeFolder}/${file}`, 'utf-8');
          result.push({ name: file, content });
          cache[cacheKey] = content;
        }
      }

      Store.set('cache', cache);

      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
