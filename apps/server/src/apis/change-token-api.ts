import {
  accessCookieConfig,
  accessCookieExpiration,
  refreshCookieConfig,
  refreshCookieExpiration,
} from '../core/cookie/cookie-config';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { generateRandomToken, hashText } from '../core/crypto';
import { generateAccessToken, generateRefreshToken, jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken, getUserRefreshToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import type jwt from 'jsonwebtoken';

export const register = (app: Application): void => {
  app.put(
    `${API_PREFIX}/user/change-token`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const users = Store.getLastValue('users');

      const newUserToken = generateRandomToken(request.username);
      const accessCookie = accessCookieConfig();
      const refreshCookie = refreshCookieConfig();
      const newAccessToken = generateAccessToken(
        request.username,
        `${accessCookieExpiration.value} ${accessCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );
      const newRefreshToken = generateRefreshToken(
        request.username,
        `${refreshCookieExpiration.value} ${refreshCookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );

      users[request.usernameHash] = {
        userTokenHash: hashText(newUserToken),
        accessTokens: [getUserAccessToken(newAccessToken, request.headers['user-agent'], accessCookie.expires)],
        refreshTokens: [getUserRefreshToken(newRefreshToken, request.headers['user-agent'], refreshCookie.expires)],
      };
      Store.set('users', users);

      const result: ChangeTokenApiResponseModel = { newToken: newUserToken };
      response
        .cookie(COOKIE_TOKEN, newAccessToken, accessCookie)
        .cookie(COOKIE_REFRESH_TOKEN, newRefreshToken, refreshCookie)
        .send(result);
    })
  );
};
