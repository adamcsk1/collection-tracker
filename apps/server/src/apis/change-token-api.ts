import { cookieConfig } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { generateRandomToken, hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeTokenApiResponseModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.put(`${API_PREFIX}/user/change-token`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const users = Store.getLastValue('users');

      const newUserToken = generateRandomToken(request.username);
      const newAccessToken = await generateAccessToken(request.username);

      users[request.usernameHash] = {
        userTokenHash: await hashText(`${newUserToken}${process.env.SALT}`),
        accessTokens: [
          {
            tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
            createdAt: dayjs().toISOString(),
            userAgent: request.headers['user-agent'],
          },
        ],
      };
      Store.set('users', users);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      const result: ChangeTokenApiResponseModel = { newToken: newUserToken };
      response.cookie(COOKIE_TOKEN, newAccessToken, cookieConfig());
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
