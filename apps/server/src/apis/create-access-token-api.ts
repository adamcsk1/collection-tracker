import { generateAccessToken, jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateAccessTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/user/access-token`, jwtGuard, (request, response) => {
    try {
      const users = Store.getLastValue('users');

      const newAccessToken = generateAccessToken(request.username);

      users[request.usernameHash].accessTokens.push(
        getUserAccessToken(newAccessToken, request.headers['user-agent'], null)
      );
      Store.set('users', users);

      const result: CreateAccessTokenApiResponseModel = { accessToken: newAccessToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
