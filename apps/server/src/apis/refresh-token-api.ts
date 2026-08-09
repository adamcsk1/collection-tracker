import { API_PREFIX } from '@shared/constants/api-const';
import type {} from '@fastify/rate-limit';
import dayjs from 'dayjs';
import type { FastifyInstance } from 'fastify';
import type jwt from 'jsonwebtoken';
import jwtLib from 'jsonwebtoken';
import { accessCookieConfig, accessCookieExpiration } from '../core/cookie/cookie-config';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import {
  deleteExpiredRefreshTokens,
  findRefreshTokensByUser,
  insertAccessToken,
} from '../core/database/repositories/user-repository';
import { generateAccessToken } from '../core/jwt';
import { debugLog, errorLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken } from '../core/utils/users-util';
import { getRefreshRateLimit } from '../core/utils/rate-limit-util';

const hasUsername = (data: jwtLib.JwtPayload | string | undefined): data is { username: string } =>
  typeof data === 'object' && data !== null && 'username' in data && typeof data.username === 'string';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/session/refresh`,
    { config: { rateLimit: { max: getRefreshRateLimit(), timeWindow: '1 minute' } } },
    withErrorHandler(async (request, response) => {
      const signedCookieToken = request.cookies[COOKIE_REFRESH_TOKEN];
      const cookieToken = signedCookieToken ? request.unsignCookie(signedCookieToken).value : undefined;
      const authorizationToken = request.headers['authorization'];
      let token = cookieToken || authorizationToken || '';
      if (token.includes('Bearer ')) token = token.split(' ')[1];

      if (!token) {
        await debugLog('No refresh token found');
        return response.code(401).send();
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        await errorLog('Refresh token validation error (JWT secret is not configured)');
        return response.code(500).send();
      }

      try {
        const data = jwtLib.verify(token, jwtSecret);
        if (!hasUsername(data)) {
          await debugLog('Refresh token payload is invalid');
          return response.code(403).send();
        }

        const { username } = data;
        const usernameHash = hashText(username);
        const tokenHash = hashText(token);
        const db = getDatabase();
        const allRefreshTokens = findRefreshTokensByUser(db, usernameHash);

        if (!allRefreshTokens.some((t) => t.tokenHash === tokenHash)) {
          await debugLog('Refresh token not recognized');
          return response.code(403).send();
        }

        const now = dayjs();
        deleteExpiredRefreshTokens(db, usernameHash, now.toISOString());
        const validTokens = allRefreshTokens.filter((t) => t.expiresAt === null || dayjs(t.expiresAt).isAfter(now));

        if (!validTokens.some((t) => t.tokenHash === tokenHash)) {
          await debugLog('Refresh token expired after prune');
          return response.code(403).send();
        }

        const cookie = accessCookieConfig();
        const newAccessToken = await generateAccessToken(
          username,
          `${accessCookieExpiration.value} ${accessCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
        );
        if (!newAccessToken) {
          return response.code(500).send();
        }

        const accessTokenData = getUserAccessToken(newAccessToken, request.headers['user-agent']!, cookie.expires!);
        insertAccessToken(db, usernameHash, accessTokenData);

        response.setCookie(COOKIE_TOKEN, newAccessToken, cookie).code(204).send();
      } catch (error: unknown) {
        if (error instanceof jwtLib.JsonWebTokenError) {
          await debugLog(`Refresh token verification failed (${error.message})`);
          return response.code(403).send();
        }

        if (error instanceof Error) await errorLog(`Refresh token validation unknown error (${error.message})`);
        return response.code(500).send();
      }
    })
  );
};
