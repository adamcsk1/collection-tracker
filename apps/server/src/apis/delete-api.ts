import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { existsSync, unlinkSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.delete(`${API_PREFIX}/delete/:name`, jwtGuard, (req: ExtendedRequestModel, res) => {
    try {
      let { name } = req.params;
      name = name.replace(/\\|\//g, '');
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${req.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return res.sendStatus(404);
      }

      unlinkSync(`${storeFolder}/${name.split('-')[1]}`);
      const cache = Store.getLastValue('cache');
      delete cache[name];
      Store.set('cache', cache);

      res.send();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
