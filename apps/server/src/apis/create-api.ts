import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateApiRequestModel, CreateApiResponseModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import type { Application } from 'express';
import { existsSync } from 'fs';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/create`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const { content } = request.body as CreateApiRequestModel;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;
      const name = `${dayjs().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.md`;

      if (existsSync(`${storeFolder}/${name}`)) {
        return response.sendStatus(409);
      }

      updateItem(name, request.usernameHash, content);

      const result: CreateApiResponseModel = { name };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
