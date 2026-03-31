import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
import { getMemoryHash } from '@server/core/utils/hash-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeApiRequestModel, ChangeApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { existsSync } from 'fs';

export const register = (app: Application): void => {
  app.put(`${API_PREFIX}/change/:name`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      let { name } = request.params;
      name = name.toString().replace(/\\|\//g, '');
      const { content, hash } = request.body as ChangeApiRequestModel;
      if (typeof content !== 'string' || typeof hash !== 'string') {
        return response.sendStatus(400);
      }
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return response.sendStatus(404);
      }

      const storedHash = getMemoryHash(request.usernameHash, name);
      if (storedHash !== hash) {
        return response.sendStatus(409);
      }

      await updateItem(name, request.usernameHash, content);

      const result: ChangeApiResponseModel = { hash: getMemoryHash(request.usernameHash, name)! };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
