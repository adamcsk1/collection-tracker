import { generateRandomToken, hashText } from '../core/crypto';
import type {} from '@fastify/rate-limit';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@shared/constants/username-const';
import { SignUpApiRequestModel, SignUpApiResponseModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { countUsers, findUserByHash, insertUser } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';
import { getAuthRateLimit } from '../core/utils/rate-limit-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/auth/sign-up`,
    { config: { rateLimit: { max: getAuthRateLimit(), timeWindow: '1 minute' } } },
    withErrorHandler((request, response) => {
      if (Number(process.env.DISABLE_REGISTRATION)) {
        return response.code(403).send();
      }

      if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
        return response.code(400).send();
      }
      const { username } = request.body as SignUpApiRequestModel;
      if (
        typeof username !== 'string' ||
        username.length < USERNAME_MIN_LENGTH ||
        username.length > USERNAME_MAX_LENGTH
      ) {
        return response.code(400).send();
      }
      const db = getDatabase();
      const usernameHash = hashText(username);

      const userCount = countUsers(db);

      const userLimit = Number(process.env.USER_LIMIT);
      if (!isNaN(userLimit) && userLimit <= userCount) {
        return response.code(403).send();
      }

      if (findUserByHash(db, usernameHash)) {
        return response.code(409).send();
      }

      const userToken = generateRandomToken();
      const userTokenHash = hashText(userToken);

      insertUser(db, usernameHash, userTokenHash, username);

      const result: SignUpApiResponseModel = { token: userToken };
      response.send(result);
    })
  );
};
