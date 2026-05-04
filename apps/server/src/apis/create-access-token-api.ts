import { API_PREFIX } from '@shared/constants/api-const';
import { CreateAccessTokenApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { insertAccessToken } from '../core/database/repositories/user-repository';
import { generateAccessToken, jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getUserAccessToken } from '../core/utils/users-util';

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/user/access-token`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const newAccessToken = await generateAccessToken(request.username);

      if (!newAccessToken) {
        return response.sendStatus(500);
      }

      const tokenData = getUserAccessToken(newAccessToken, request.headers['user-agent']!, null);
      insertAccessToken(getDatabase(), request.usernameHash, tokenData);

      const result: CreateAccessTokenApiResponseModel = { accessToken: newAccessToken };
      response.send(result);
    })
  );
};
