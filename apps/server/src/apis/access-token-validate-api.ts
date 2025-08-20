import { cookieConfig, cookieExpiration } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/user/access-token/validate`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const tokenFrom = !!request.headers['authorization'] ? 'authorization' : 'cookie';
      const users = Store.getLastValue('users');

      if (tokenFrom === 'cookie') {
        const tokenHash = await hashText(`${request.signedCookies[COOKIE_TOKEN]}${process.env.SALT}`);
        const cookie = cookieConfig();
        const newAccessToken = await generateAccessToken(
          request.username,
          `${cookieExpiration.value} ${cookieExpiration.unit}`
        );
        users[request.usernameHash].accessTokens.push({
          tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
          createdAt: dayjs().toISOString(),
          userAgent: request.headers['user-agent'],
          expiredAt: cookie.expires.toISOString(),
        });

        users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
          (token) => token.tokenHash !== tokenHash
        );

        Store.set('users', users);

        writeFileSync(
          `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
          JSON.stringify(users, null, 2),
          { encoding: 'utf-8' }
        );

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie).sendStatus(204);
      } else response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
