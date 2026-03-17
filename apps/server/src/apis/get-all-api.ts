import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { readStoreFiles } from '@server/core/utils/cache-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { GetAllApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/get-all`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const limit = Number(request.query.limit) || 10;
      const offset = Number(request.query.offset) || 0;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      const result: GetAllApiResponseModel = await readStoreFiles(storeFolder, request.usernameHash, offset, limit);

      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
