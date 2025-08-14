import { hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { ChangeTokenApiRequestModel, ChangeTokenApiResponseModel } from '@shared/models/api-model';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.put(`${API_PREFIX}/user/change-token`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      let { expiration } = request.body as ChangeTokenApiRequestModel;
      const users = Store.getLastValue('users');

      const newAccessToken = generateAccessToken(request.usernameHash, expiration);

      if (!newAccessToken) return response.sendStatus(500);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      users[request.usernameHash].accessTokenHash = await hashText(`${newAccessToken}${process.env.SALT}`);
      Store.set('users', users);

      const result: ChangeTokenApiResponseModel = { newToken: newAccessToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
