import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import dayjs from 'dayjs';
import { existsSync, writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/create`, jwtGuard, (req: ExtendedRequestModel, res) => {
    try {
      const { content } = req.body;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${req.usernameHash}`;
      const name = `${dayjs().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.md`;

      if (existsSync(`${storeFolder}/${name}`)) {
        return res.sendStatus(409);
      }

      writeFileSync(`${storeFolder}/${name}`, content, { encoding: 'utf-8' });
      const cache = Store.getLastValue('cache');
      const checkKey = `${req.usernameHash}-${name}`;
      cache[checkKey] = content;
      Store.set('cache', cache);

      res.send({ name });
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
