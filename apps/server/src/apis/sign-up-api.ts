import { generateRandomToken, hashText } from '@server/core/crypto';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { SignUpApiRequestModel, SignUpApiResponseModel } from '@shared/models/api-model';
import { mkdirSync, writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-up`, async (req, res) => {
    try {
      if (Number(process.env.DISABLE_REGISTRATION)) {
        return res.sendStatus(403);
      }

      const { username } = req.body as SignUpApiRequestModel;
      const users = Store.getLastValue('users');

      const userLimit = Number(process.env.USER_LIMIT);
      if (!isNaN(userLimit) && userLimit <= Object.keys(users).length) {
        return res.sendStatus(403);
      }

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (users[usernameHash]) {
        return res.sendStatus(409);
      }

      const userToken = generateRandomToken();

      users[usernameHash] = { userTokenHash: await hashText(`${userToken}${process.env.SALT}`), accessTokens: [] };
      Store.set('users', users);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      mkdirSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${usernameHash}`, { recursive: true });

      const result: SignUpApiResponseModel = { token: userToken };
      res.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
