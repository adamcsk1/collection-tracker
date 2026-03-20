import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { UserSettingsModel } from '@server/models/user-settings-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiRequestModel } from '@shared/models/api-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { isAllowedValue } from '@shared/utils/parse-allowed-value-util';
import type { Application } from 'express';

const isAllowedNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isAllowedBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isAllowedTheme = (value: unknown): value is UserSettingsModel['theme'] =>
  typeof value === 'string' && isAllowedValue(value, THEMES);
const isAllowedLanguage = (value: unknown): value is UserSettingsModel['language'] =>
  typeof value === 'string' && isAllowedValue(value, LANGUAGES);

const isValidUserSettings = (body: unknown): body is UserSettingsApiRequestModel => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;

  const candidate = body as Record<string, unknown>;

  return Object.entries(candidate).every(([key, value]) => {
    switch (key) {
      case 'fetchBatchSize':
        return isAllowedNumber(value);
      case 'theme':
        return isAllowedTheme(value);
      case 'animatedBackground':
        return isAllowedBoolean(value);
      case 'language':
        return isAllowedLanguage(value);
      default:
        return false;
    }
  });
};

export const register = (app: Application): void => {
  app.post(`${API_PREFIX}/user/settings`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const body = request.body as UserSettingsApiRequestModel;
      if (!isValidUserSettings(body)) return response.sendStatus(400);

      const userSettings = Store.getLastValue('userSettings');
      let userConfig = userSettings?.[request.usernameHash];

      if (!userConfig) userConfig = {} satisfies UserSettingsModel;

      if (body.fromLogin) {
        if (body.language && userConfig.language) delete body.language;
        if (body.theme && userConfig.theme) delete body.theme;
      }

      const updatedConfig = { ...userConfig, ...body } satisfies UserSettingsModel;
      userSettings[request.usernameHash] = updatedConfig;
      Store.set('userSettings', userSettings);

      response.send(updatedConfig);
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
