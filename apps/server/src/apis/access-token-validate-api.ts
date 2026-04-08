import { cookieConfig, cookieExpiration } from '../core/cookie/cookie-config';
import { COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { generateAccessToken, jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import type jwt from 'jsonwebtoken';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/user/access-token/validate`, jwtGuard, (request, response) => {
    try {
      const tokenFrom = !!request.headers['authorization'] ? 'authorization' : 'cookie';
      const users = Store.getLastValue('users');

      if (tokenFrom === 'cookie') {
        const tokenHash = hashText(request.signedCookies[COOKIE_TOKEN]);
        const cookie = cookieConfig();
        const newAccessToken = generateAccessToken(
          request.username,
          `${cookieExpiration.value} ${cookieExpiration.unit}` as jwt.SignOptions['expiresIn']
        );
        users[request.usernameHash].accessTokens.push(
          getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)
        );

        users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
          (token) => token.tokenHash !== tokenHash
        );
        Store.set('users', users);

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie).sendStatus(204);
      } else response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
