import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/user/settings`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const userSettings = Store.getLastValue('userSettings');
      const result: UserSettingsApiResponseModel = {
        ...userSettings?.[request.usernameHash],
        claudeAiAvailable: !!process.env.CLAUDE_API_KEY,
      };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
