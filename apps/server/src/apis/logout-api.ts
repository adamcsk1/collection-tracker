import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/logout`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const cookieToken = request.signedCookies[COOKIE_TOKEN];
      const authorizationToken = request.headers['authorization'];
      let token = cookieToken || authorizationToken || '';
      if (token.includes('Bearer ')) token = token.split(' ')[1];

      const tokenHash = hashText(token);
      const users = Store.getLastValue('users');

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (accessTokens) => accessTokens.tokenHash !== tokenHash
      );
      Store.set('users', users);

      if (cookieToken) response.clearCookie(COOKIE_TOKEN).sendStatus(204);
      else response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
