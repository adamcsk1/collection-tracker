import { COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/logout`, jwtGuard, (request, response) => {
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
