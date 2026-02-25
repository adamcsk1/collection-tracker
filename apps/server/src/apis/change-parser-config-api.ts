import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { ParserConfigModel } from '@server/models/parser-config-model';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/parser/change-config`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const parserConfigs = Store.getLastValue('parserConfigs');
      let userConfig = parserConfigs?.[request.usernameHash];

      if (!userConfig) userConfig = {} as ParserConfigModel;

      const updatedConfig = { ...userConfig, ...request.body };
      parserConfigs[request.usernameHash] = updatedConfig;
      Store.set('parserConfigs', parserConfigs);

      response.send(updatedConfig);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
