import { hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateAccessTokenApiResponseModel } from '@shared/models/api-model';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/user/access-token`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const users = Store.getLastValue('users');

      const newAccessToken = await generateAccessToken(request.username);

      users[request.usernameHash].accessTokens.push({
        tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
        createdAt: dayjs().toISOString(),
        userAgent: request.headers['user-agent'],
      });
      Store.set('users', users);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      const result: CreateAccessTokenApiResponseModel = { accessToken: newAccessToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
