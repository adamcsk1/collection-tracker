import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { existsSync, writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.put(`${API_PREFIX}/modify/:name`, jwtGuard, (req: ExtendedRequestModel, res) => {
    try {
      let { name } = req.params;
      name = name.replace(/\\|\//g, '');
      const { content } = req.body;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${req.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return res.sendStatus(404);
      }

      writeFileSync(`${storeFolder}/${name.split('-')[1]}`, content, { encoding: 'utf-8' });
      const cache = Store.getLastValue('cache');
      cache[name] = content;
      Store.set('cache', cache);

      res.send({ message: name });
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
