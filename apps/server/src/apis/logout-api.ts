import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(
    `${API_PREFIX}/logout`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const cookieToken = request.signedCookies[COOKIE_TOKEN];
      const authorizationToken = request.headers['authorization'];
      let token = cookieToken || authorizationToken || '';
      if (token.includes('Bearer ')) token = token.split(' ')[1];

      const tokenHash = hashText(token);
      const users = Store.getLastValue('users');

      const refreshCookieToken = request.signedCookies[COOKIE_REFRESH_TOKEN];
      let refreshToken = refreshCookieToken || '';
      if (refreshToken.includes('Bearer ')) refreshToken = refreshToken.split(' ')[1];
      const refreshTokenHash = hashText(refreshToken);

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (accessToken) => accessToken.tokenHash !== tokenHash
      );
      users[request.usernameHash].refreshTokens = (users[request.usernameHash].refreshTokens || []).filter(
        (rt) => rt.tokenHash !== refreshTokenHash
      );
      Store.set('users', users);

      response.clearCookie(COOKIE_TOKEN).clearCookie(COOKIE_REFRESH_TOKEN).sendStatus(204);
    })
  );
};
