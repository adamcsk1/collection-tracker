import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { removeItem } from '../core/utils/cache-util';
import { getMemoryHash } from '../core/utils/hash-util';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { existsSync } from 'fs';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/delete/:name`, jwtGuard, async (request, response) => {
    try {
      let { name } = request.params;
      name = name.toString().replace(/\\|\//g, '');
      const { hash } = request.query as { hash: string };
      if (typeof hash !== 'string') {
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

      await removeItem(name, request.usernameHash);

      response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
