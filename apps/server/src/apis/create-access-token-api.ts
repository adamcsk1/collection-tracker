import { generateAccessToken, jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateAccessTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/user/access-token`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const users = Store.getLastValue('users');

      const newAccessToken = generateAccessToken(request.username);

      users[request.usernameHash].accessTokens.push(
        getUserAccessToken(newAccessToken, request.headers['user-agent'], null)
      );
      Store.set('users', users);

      const result: CreateAccessTokenApiResponseModel = { accessToken: newAccessToken };
      response.send(result);
    })
  );
};
