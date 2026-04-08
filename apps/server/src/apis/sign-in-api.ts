import { cookieConfig, cookieExpiration } from '../core/cookie/cookie-config';
import { COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { hashText } from '../core/crypto';
import { generateAccessToken } from '../core/jwt';
import { errorLog } from '../core/logger';
import { Store } from '../core/store/store';
import { getUserAccessToken } from '../core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { SignInApiRequestModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import type { Application } from 'express';
import type jwt from 'jsonwebtoken';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/sign-in`, (request, response) => {
    try {
      const { username, token } = request.body as SignInApiRequestModel;
      if (typeof username !== 'string' || !username || typeof token !== 'string' || !token) {
        return response.sendStatus(400);
      }
      const users = Store.getLastValue('users');

      const usernameHash = hashText(username);

      if (!users[usernameHash]) return response.sendStatus(404);

      const userTokenHash = hashText(token);

      if (users[usernameHash].userTokenHash !== userTokenHash) return response.sendStatus(401);

      const cookie = cookieConfig();
      const newAccessToken = generateAccessToken(
        username,
        `${cookieExpiration.value} ${cookieExpiration.unit}` as jwt.SignOptions['expiresIn']
      );
      users[usernameHash].accessTokens.push(
        getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)
      );
      users[usernameHash].accessTokens = users[usernameHash].accessTokens.filter(
        (token) => token.expiresAt === null || dayjs(token.expiresAt).isAfter(dayjs())
      );
      Store.set('users', users);

      response.cookie(COOKIE_TOKEN, newAccessToken, cookie).send();
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
