import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { existsSync, rmSync } from 'fs';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/user`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      if (existsSync(storeFolder)) rmSync(storeFolder, { recursive: true, force: true });

      const cache = Store.getLastValue('cache');
      for (const key in cache) {
        if (key.startsWith(`${request.usernameHash}-`)) delete cache[key];
      }
      Store.set('cache', cache);

      const users = Store.getLastValue('users');
      delete users[request.usernameHash];
      Store.set('users', users);

      response.send();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
