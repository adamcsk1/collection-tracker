import { generateRandomToken, hashText } from '@server/core/crypto';
import { errorLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { updateUsers } from '@server/core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { SignUpApiRequestModel, SignUpApiResponseModel } from '@shared/models/api-model';
import { mkdirSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-up`, async (request, response) => {
    try {
      if (Number(process.env.DISABLE_REGISTRATION)) {
        return response.sendStatus(403);
      }

      const { username } = request.body as SignUpApiRequestModel;
      const users = Store.getLastValue('users');

      const userLimit = Number(process.env.USER_LIMIT);
      if (!isNaN(userLimit) && userLimit <= Object.keys(users).length) {
        return response.sendStatus(403);
      }

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (users[usernameHash]) {
        return response.sendStatus(409);
      }

      const userToken = generateRandomToken(username);

      users[usernameHash] = { userTokenHash: await hashText(`${userToken}${process.env.SALT}`), accessTokens: [] };
      updateUsers(users);

      mkdirSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${usernameHash}`, { recursive: true });

      const result: SignUpApiResponseModel = { token: userToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
