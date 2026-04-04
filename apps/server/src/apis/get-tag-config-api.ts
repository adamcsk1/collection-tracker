import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagConfigsApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/tag/config`, jwtGuard, (request, response) => {
    try {
      const tagConfigs = Store.getLastValue('tagConfigs');
      const result: TagConfigsApiResponseModel = tagConfigs?.[request.usernameHash] || [];
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
