import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/user/access-tokens`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const users = Store.getLastValue('users');
      const result: AccessTokensApiResponseModel = users[request.usernameHash].accessTokens;
      response.send(result);
    })
  );
};
