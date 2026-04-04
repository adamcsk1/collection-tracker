import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/user/access-tokens`, jwtGuard, (request, response) => {
    try {
      const users = Store.getLastValue('users');
      const result: AccessTokensApiResponseModel = users[request.usernameHash].accessTokens;
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
