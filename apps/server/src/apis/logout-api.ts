import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { deleteAccessToken, deleteRefreshToken } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/logout`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const signedCookieToken = request.cookies[COOKIE_TOKEN];
      const cookieToken = signedCookieToken ? request.unsignCookie(signedCookieToken).value : undefined;
      const authorizationToken = request.headers['authorization'];
      let token = cookieToken || authorizationToken || '';
      if (token.includes('Bearer ')) token = token.split(' ')[1];

      const tokenHash = hashText(token);

      const signedRefreshCookieToken = request.cookies[COOKIE_REFRESH_TOKEN];
      const refreshCookieToken = signedRefreshCookieToken
        ? request.unsignCookie(signedRefreshCookieToken).value
        : undefined;
      let refreshToken = refreshCookieToken || '';
      if (refreshToken.includes('Bearer ')) refreshToken = refreshToken.split(' ')[1];
      const refreshTokenHash = hashText(refreshToken);

      const db = getDatabase();
      deleteAccessToken(db, request.usernameHash, tokenHash);
      deleteRefreshToken(db, request.usernameHash, refreshTokenHash);

      response.clearCookie(COOKIE_TOKEN).clearCookie(COOKIE_REFRESH_TOKEN).code(204).send();
    })
  );
};
