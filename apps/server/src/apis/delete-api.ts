import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { existsSync, unlinkSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.delete(`${API_PREFIX}/delete/:name`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      let { name } = request.params;
      name = name.replace(/\\|\//g, '');
      const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${request.usernameHash}`;

      if (!existsSync(`${storeFolder}/${name}`)) {
        return response.sendStatus(404);
      }

      unlinkSync(`${storeFolder}/${name}`);
      const cache = Store.getLastValue('cache');
      const checkKey = `${request.usernameHash}-${name}`;
      delete cache[checkKey];
      Store.set('cache', cache);

      response.send();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
