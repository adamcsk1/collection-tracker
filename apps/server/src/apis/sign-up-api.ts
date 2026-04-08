import { generateRandomToken, hashText } from '../core/crypto';
import { errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { Store } from '../core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import { SignUpApiRequestModel, SignUpApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { mkdirSync } from 'fs';

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/sign-up`, (request, response) => {
    try {
      if (Number(process.env.DISABLE_REGISTRATION)) {
        return response.sendStatus(403);
      }

      const { username } = request.body as SignUpApiRequestModel;
      if (typeof username !== 'string' || !username) {
        return response.sendStatus(400);
      }
      const users = Store.getLastValue('users');

      const userLimit = Number(process.env.USER_LIMIT);
      if (!isNaN(userLimit) && userLimit <= Object.keys(users).length) {
        return response.sendStatus(403);
      }

      const usernameHash = hashText(username);

      if (users[usernameHash]) {
        return response.sendStatus(409);
      }

      const userToken = generateRandomToken(username);

      users[usernameHash] = { userTokenHash: hashText(userToken), accessTokens: [] };
      Store.set('users', users);

      mkdirSync(`${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${usernameHash}`, { recursive: true });

      const result: SignUpApiResponseModel = { token: userToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
