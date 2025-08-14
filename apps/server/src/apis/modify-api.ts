import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { ModifyApiRequestModel } from '@shared/models/api-model';
import { existsSync, writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.put(`${API_PREFIX}/modify/:name`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      let { name } = request.params;
      name = name.replace(/\\|\//g, '');
      const { content } = request.body as ModifyApiRequestModel;
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return response.sendStatus(404);
      }

      writeFileSync(`${storeFolder}/${name}`, content, { encoding: 'utf-8' });
      const cache = Store.getLastValue('cache');
      const checkKey = `${request.usernameHash}-${name}`;
      cache[checkKey] = content;
      Store.set('cache', cache);

      response.send();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
