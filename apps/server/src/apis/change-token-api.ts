import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeTokenApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import type jwt from 'jsonwebtoken';
import {
  accessCookieConfig,
  accessCookieExpiration,
  refreshCookieConfig,
  refreshCookieExpiration,
} from '../core/cookie/cookie-config';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { generateRandomToken, hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import {
  deleteTokensByUser,
  insertAccessToken,
  insertRefreshToken,
  upsertUser,
} from '../core/database/repositories/user-repository';
import { generateAccessToken, generateRefreshToken, jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken, getUserRefreshToken } from '../core/utils/users-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/users/me/token`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();

      const newUserToken = generateRandomToken();
      const accessCookie = accessCookieConfig();
      const refreshCookie = refreshCookieConfig();
      const newAccessToken = await generateAccessToken(
        request.username,
        `${accessCookieExpiration.value} ${accessCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );
      const newRefreshToken = await generateRefreshToken(
        request.username,
        `${refreshCookieExpiration.value} ${refreshCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );

      if (!newAccessToken || !newRefreshToken) {
        return response.code(500).send();
      }

      const userAgent = request.headers['user-agent'] ?? '';
      const accessTokenData = getUserAccessToken(newAccessToken, userAgent, accessCookie.expires!);
      const refreshTokenData = getUserRefreshToken(newRefreshToken, userAgent, refreshCookie.expires!);

      db.transaction(() => {
        upsertUser(db, request.usernameHash, hashText(newUserToken));
        deleteTokensByUser(db, request.usernameHash);
        insertAccessToken(db, request.usernameHash, accessTokenData);
        insertRefreshToken(db, request.usernameHash, refreshTokenData);
      })();

      const result: ChangeTokenApiResponseModel = { newToken: newUserToken };
      response
        .setCookie(COOKIE_TOKEN, newAccessToken, accessCookie)
        .setCookie(COOKIE_REFRESH_TOKEN, newRefreshToken, refreshCookie)
        .send(result);
    })
  );
};
