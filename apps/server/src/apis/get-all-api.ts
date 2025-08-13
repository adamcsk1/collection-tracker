import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { readdirSync, readFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/get-all`, jwtGuard, (req: ExtendedRequestModel, res) => {
    try {
      const limit = Number(req.query.limit) || 10;
      const offset = Number(req.query.offset) || 0;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${req.usernameHash}`;
      const cache = Store.getLastValue('cache');
      const files = readdirSync(storeFolder)
        .sort((a, b) => -a.localeCompare(b))
        .slice(offset, offset + limit);

      const response = [];
      for (const file of files) {
        const cacheKey = `${req.usernameHash}-${file}`;
        if (!!cache[cacheKey]) response.push({ name: file, content: cache[cacheKey] });
        else {
          const content = readFileSync(`${storeFolder}/${file}`, 'utf-8');
          response.push({ name: file, content });
          cache[cacheKey] = content;
        }
      }

      Store.set('cache', cache);

      res.send(response);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
