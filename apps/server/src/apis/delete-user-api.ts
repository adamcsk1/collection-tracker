import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { existsSync, rmSync, writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.delete(`${API_PREFIX}/user/delete`, jwtGuard, (req: ExtendedRequestModel, res) => {
    try {
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${req.usernameHash}`;

      if (existsSync(storeFolder)) rmSync(storeFolder, { recursive: true, force: true });

      const cache = Store.getLastValue('cache');
      for (const key in cache) {
        if (key.startsWith(`${req.usernameHash}-`)) delete cache[key];
      }
      Store.set('cache', cache);

      const users = Store.getLastValue('users');
      delete users[req.usernameHash];
      Store.set('users', users);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      res.send();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
