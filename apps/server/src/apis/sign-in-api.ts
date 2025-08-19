import { cookieConfig, cookieExpiration } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { generateAccessToken } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import { SignInApiRequestModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-in`, async (request, response) => {
    try {
      const { username, token } = request.body as SignInApiRequestModel;
      const users = Store.getLastValue('users');

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (!users[usernameHash]) return response.sendStatus(404);

      const userTokenHash = await hashText(`${token}${process.env.SALT}`);

      if (users[usernameHash].userTokenHash !== userTokenHash) return response.sendStatus(401);

      if (users[usernameHash].userTokenHash === userTokenHash) {
        const cookie = cookieConfig();
        const newAccessToken = await generateAccessToken(
          username,
          `${cookieExpiration.value} ${cookieExpiration.unit}`
        );
        users[usernameHash].accessTokens.push({
          tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
          createdAt: dayjs().toISOString(),
          userAgent: request.headers['user-agent'],
          expiredAt: cookie.expires.toISOString(),
        });
        users[usernameHash].accessTokens = users[usernameHash].accessTokens.filter(
          (token) => token.expiredAt !== null && dayjs(token.expiredAt).isAfter(dayjs())
        );
        Store.set('users', users);

        writeFileSync(
          `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
          JSON.stringify(users, null, 2),
          { encoding: 'utf-8' }
        );

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie);
        response.send();
      } else {
        response.sendStatus(403);
      }
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
