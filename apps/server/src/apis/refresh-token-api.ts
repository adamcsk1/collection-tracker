import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { accessCookieConfig, accessCookieExpiration } from '../core/cookie/cookie-config';
import { hashText } from '../core/crypto';
import { generateAccessToken } from '../core/jwt';
import { debugLog, errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import type jwt from 'jsonwebtoken';
import jwtLib from 'jsonwebtoken';
import dayjs from 'dayjs';

const hasUsername = (data: jwtLib.JwtPayload | string | undefined): data is { username: string } =>
  typeof data === 'object' && data !== null && 'username' in data && typeof data.username === 'string';

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/session/refresh`,
    withErrorHandler((request, response) => {
      const cookieToken = request.signedCookies[COOKIE_REFRESH_TOKEN];
      const authorizationToken = request.headers['authorization'];
      let token = cookieToken || authorizationToken || '';
      if (token.includes('Bearer ')) token = token.split(' ')[1];

      if (!token) {
        void debugLog('No refresh token found');
        return response.sendStatus(401);
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        void errorLog('Refresh token validation error (JWT secret is not configured)');
        return response.sendStatus(500);
      }

      jwtLib.verify(
        token,
        jwtSecret,
        (error: jwtLib.VerifyErrors | null, data: jwtLib.JwtPayload | string | undefined) => {
          try {
            if (error) {
              void debugLog(`Refresh token verification failed (${error.message})`);
              return response.sendStatus(403);
            }

            if (!hasUsername(data)) {
              void debugLog('Refresh token payload is invalid');
              return response.sendStatus(403);
            }

            const { username } = data;
            const usernameHash = hashText(username);
            const users = Store.getLastValue('users');
            const tokenHash = hashText(token);

            if (!users?.[usernameHash]?.refreshTokens?.map((t) => t.tokenHash)?.includes(tokenHash)) {
              void debugLog('Refresh token not recognized');
              return response.sendStatus(403);
            }

            const now = dayjs();
            users[usernameHash].refreshTokens = (users[usernameHash].refreshTokens || []).filter(
              (t) => t.expiresAt === null || dayjs(t.expiresAt).isAfter(now)
            );

            if (!users[usernameHash].refreshTokens.some((t) => t.tokenHash === tokenHash)) {
              void debugLog('Refresh token expired after prune');
              return response.sendStatus(403);
            }

            const cookie = accessCookieConfig();
            const newAccessToken = generateAccessToken(
              username,
              `${accessCookieExpiration.value} ${accessCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
            );
            if (!newAccessToken) {
              void errorLog('Failed to generate new access token during refresh');
              return response.sendStatus(500);
            }

            users[usernameHash].accessTokens.push(
              getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)
            );
            Store.set('users', users);

            response.cookie(COOKIE_TOKEN, newAccessToken, cookie).sendStatus(204);
          } catch (error: unknown) {
            if (error instanceof Error) void errorLog(`Refresh token validation unknown error (${error.message})`);
            response.sendStatus(500);
          }
        }
      );
    })
  );
};
