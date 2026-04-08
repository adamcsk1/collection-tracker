import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { existsSync, rmSync } from 'fs';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/user`, jwtGuard, (request, response) => {
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

      const userSettings = Store.getLastValue('userSettings');
      delete userSettings[request.usernameHash];
      Store.set('userSettings', userSettings);

      response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
