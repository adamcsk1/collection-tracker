import { API_PREFIX } from '@shared/constants/api-const';
import type {} from '@fastify/rate-limit';
import { SignInApiRequestModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import type { FastifyInstance } from 'fastify';
import type jwt from 'jsonwebtoken';
import {
  accessCookieConfig,
  accessCookieExpiration,
  refreshCookieConfig,
  refreshCookieExpiration,
} from '../core/cookie/cookie-config';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import {
  deleteExpiredAccessTokens,
  deleteExpiredRefreshTokens,
  findUserByHash,
  insertAccessToken,
  insertRefreshToken,
} from '../core/database/repositories/user-repository';
import { generateAccessToken, generateRefreshToken } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken, getUserRefreshToken } from '../core/utils/users-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/sign-in`,
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    withErrorHandler(async (request, response) => {
      const { username, token } = request.body as SignInApiRequestModel;
      if (typeof username !== 'string' || !username || typeof token !== 'string' || !token) {
        return response.code(400).send();
      }
      const db = getDatabase();
      const usernameHash = hashText(username);

      const dbUser = findUserByHash(db, usernameHash);

      if (!dbUser) return response.code(404).send();

      const userTokenHash = hashText(token);

      if (dbUser.user_token_hash !== userTokenHash) return response.code(401).send();

      const accessCookie = accessCookieConfig();
      const refreshCookie = refreshCookieConfig();
      const newAccessToken = await generateAccessToken(
        username,
        `${accessCookieExpiration.value} ${accessCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );
      const newRefreshToken = await generateRefreshToken(
        username,
        `${refreshCookieExpiration.value} ${refreshCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );

      if (!newAccessToken || !newRefreshToken) {
        return response.code(500).send();
      }

      const accessTokenData = getUserAccessToken(newAccessToken, request.headers['user-agent']!, accessCookie.expires!);
      const refreshTokenData = getUserRefreshToken(
        newRefreshToken,
        request.headers['user-agent']!,
        refreshCookie.expires!
      );

      const now = dayjs().toISOString();
      deleteExpiredAccessTokens(db, usernameHash, now);
      deleteExpiredRefreshTokens(db, usernameHash, now);
      insertAccessToken(db, usernameHash, accessTokenData);
      insertRefreshToken(db, usernameHash, refreshTokenData);

      response
        .setCookie(COOKIE_TOKEN, newAccessToken, accessCookie)
        .setCookie(COOKIE_REFRESH_TOKEN, newRefreshToken, refreshCookie)
        .send();
    })
  );
};
