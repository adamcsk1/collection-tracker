import { cookieConfig, cookieExpiration } from '../core/cookie/cookie-config';
import { COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { generateRandomToken, hashText } from '../core/crypto';
import { generateAccessToken, jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import type jwt from 'jsonwebtoken';

export const register = (app: Application): void => {
  app.put(`${API_PREFIX}/user/change-token`, jwtGuard, (request, response) => {
    try {
      const users = Store.getLastValue('users');

      const newUserToken = generateRandomToken(request.username);
      const cookie = cookieConfig();
      const newAccessToken = generateAccessToken(
        request.username,
        `${cookieExpiration.value} ${cookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );

      users[request.usernameHash] = {
        userTokenHash: hashText(newUserToken),
        accessTokens: [getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)],
      };
      Store.set('users', users);

      const result: ChangeTokenApiResponseModel = { newToken: newUserToken };
      response.cookie(COOKIE_TOKEN, newAccessToken, cookie).send(result);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
