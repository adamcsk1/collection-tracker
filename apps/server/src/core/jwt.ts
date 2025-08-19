import { cookieConfig, cookieExpiration } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import express from 'express';
import { writeFileSync } from 'fs';
import jwt from 'jsonwebtoken';

export const generateAccessToken = (username: string, expiresIn: string | null = null): string | null => {
  try {
    let options: any = {};

    if (!!expiresIn) options.expiresIn = expiresIn;

    return jwt.sign({ username, id: randomUUID() }, `${process.env.JWT_SECRET}`, options);
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Access token generation unknown error (${error.message})`);
    return null;
  }
};

export const jwtGuard = async (
  request: ExtendedRequestModel,
  response: express.Response,
  next: () => void
): Promise<express.Response> => {
  const cookieToken = request.signedCookies[COOKIE_TOKEN];
  const authorizationToken = request.headers['authorization'];
  const tokenFrom = !!request.headers['authorization'] ? 'authorization' : 'cookie';
  let token = cookieToken || authorizationToken || '';
  if (token.includes('Bearer ')) token = token.split(' ')[1];

  if (!token) return response.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET as string, async (err: any, data: any) => {
    try {
      if (err) return response.sendStatus(403);

      const usernameHash = await hashText(`${data.username}${process.env.SALT}`);
      const users = Store.getLastValue('users');
      const tokenHash = await hashText(`${token}${process.env.SALT}`);

      if (!users[usernameHash]?.accessTokens?.map((token) => token.tokenHash)?.includes(tokenHash)) {
        return response.sendStatus(403);
      }

      request.username = data.username;
      request.usernameHash = usernameHash;

      if (tokenFrom === 'cookie') {
        const cookie = cookieConfig();
        const newAccessToken = await generateAccessToken(
          data.username,
          `${cookieExpiration.value} ${cookieExpiration.unit}`
        );
        users[usernameHash].accessTokens.push({
          tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
          createdAt: dayjs().toISOString(),
          userAgent: request.headers['user-agent'],
          expiredAt: cookie.expires.toISOString(),
        });

        users[usernameHash].accessTokens = users[usernameHash].accessTokens.filter(
          (token) => token.tokenHash !== tokenHash
        );

        Store.set('users', users);

        writeFileSync(
          `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
          JSON.stringify(users, null, 2),
          { encoding: 'utf-8' }
        );

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie);
      }

      next();
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Access token validation unknown error (${error.message})`);
      return response.sendStatus(500);
    }
  });
};
