import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagConfigsApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/tag/config`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const tagConfigs = Store.getLastValue('tagConfigs');
      const result: TagConfigsApiResponseModel = tagConfigs?.[request.usernameHash] || [];
      response.send(result);
    })
  );
};
