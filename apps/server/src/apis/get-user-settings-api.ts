import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiResponseModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { findUserSettings } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/user/settings`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const dbSettings = findUserSettings(getDatabase(), request.usernameHash);

      const result: UserSettingsApiResponseModel = {
        ...(dbSettings || {}),
        claudeAiAvailable: !!process.env.CLAUDE_API_KEY,
      };
      response.send(result);
    })
  );
};
