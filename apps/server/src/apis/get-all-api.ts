import { jwtGuard } from '../core/jwt';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { readStoreFiles } from '../core/utils/cache-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { GetAllApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/get-all`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const limit = Number(request.query.limit) || 10;
      const offset = Number(request.query.offset) || 0;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      const result: GetAllApiResponseModel = await readStoreFiles(storeFolder, request.usernameHash, offset, limit);

      response.send(result);
    })
  );
};
