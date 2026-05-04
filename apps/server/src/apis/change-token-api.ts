import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
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

export const register = (app: Application): void => {
  app.put(
    `${API_PREFIX}/user/change-token`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const db = getDatabase();

      const newUserToken = generateRandomToken(request.username);
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
        return response.sendStatus(500);
      }

      const accessTokenData = getUserAccessToken(newAccessToken, request.headers['user-agent']!, accessCookie.expires!);
      const refreshTokenData = getUserRefreshToken(
        newRefreshToken,
        request.headers['user-agent']!,
        refreshCookie.expires!
      );

      upsertUser(db, request.usernameHash, hashText(newUserToken));
      deleteTokensByUser(db, request.usernameHash);
      insertAccessToken(db, request.usernameHash, accessTokenData);
      insertRefreshToken(db, request.usernameHash, refreshTokenData);

      const result: ChangeTokenApiResponseModel = { newToken: newUserToken };
      response
        .cookie(COOKIE_TOKEN, newAccessToken, accessCookie)
        .cookie(COOKIE_REFRESH_TOKEN, newRefreshToken, refreshCookie)
        .send(result);
    })
  );
};
