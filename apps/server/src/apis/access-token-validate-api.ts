import { cookieConfig, cookieExpiration } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { getUserAccessToken } from '@server/core/utils/users-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/user/access-token/validate`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const tokenFrom = !!request.headers['authorization'] ? 'authorization' : 'cookie';
      const users = Store.getLastValue('users');

      if (tokenFrom === 'cookie') {
        const tokenHash = await hashText(request.signedCookies[COOKIE_TOKEN]);
        const cookie = cookieConfig();
        const newAccessToken = generateAccessToken(
          request.username,
          `${cookieExpiration.value} ${cookieExpiration.unit}`
        );
        users[request.usernameHash].accessTokens.push(
          await getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)
        );

        users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
          (token) => token.tokenHash !== tokenHash
        );
        Store.set('users', users);

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie).sendStatus(204);
      } else response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
