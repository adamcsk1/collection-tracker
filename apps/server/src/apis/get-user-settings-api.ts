import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/user/settings`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const userSettings = Store.getLastValue('userSettings');
      const result: UserSettingsApiResponseModel = {
        ...userSettings?.[request.usernameHash],
        claudeAiAvailable: !!process.env.CLAUDE_API_KEY,
      };
      response.send(result);
    })
  );
};
