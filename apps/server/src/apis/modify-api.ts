import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { ModifyApiRequestModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { existsSync } from 'fs';

export const register = (app: Application): void => {
  app.put(`${API_PREFIX}/modify/:name`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      let { name } = request.params;
      name = name.toString().replace(/\\|\//g, '');
      const { content } = request.body as ModifyApiRequestModel;
      if (typeof content !== 'string') {
        return response.sendStatus(400);
      }
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return response.sendStatus(404);
      }

      await updateItem(name, request.usernameHash, content);

      response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
