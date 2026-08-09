import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserSettings } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/users/me/settings`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const dbSettings = findUserSettings(getDatabase(), request.usernameHash);
      const result: UserSettingsApiResponseModel = dbSettings || {};
      response.send(result);
    })
  );
};
