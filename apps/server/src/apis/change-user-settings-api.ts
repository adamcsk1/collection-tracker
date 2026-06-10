import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { UserSettingsApiRequestModel, UserSettingsApiResponseModel } from '@shared/models/api-model';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
} from '@shared/models/collection-list-display-preferences-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { isAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { getDatabase } from '../core/database/database';
import { findUserSettings, upsertUserSettings } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';

const isAllowedBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isAllowedTheme = (value: unknown): value is UserSettingsApiResponseModel['theme'] =>
  typeof value === 'string' && isAllowedValue(value, THEMES);
const isAllowedLanguage = (value: unknown): value is UserSettingsApiResponseModel['language'] =>
  typeof value === 'string' && isAllowedValue(value, LANGUAGES);
const isAllowedDefaultLibraryOwnerShareCode = (
  value: unknown
): value is UserSettingsApiResponseModel['defaultLibraryOwnerShareCode'] =>
  value === null || (typeof value === 'string' && value.trim().length > 0);

const isAllowedCollectionListDisplayPreferences = (value: unknown): value is CollectionListDisplayPreferencesModel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.showYear === 'boolean' &&
    typeof candidate.showSharedIcon === 'boolean' &&
    typeof candidate.preferredRating === 'string' &&
    COLLECTION_LIST_DISPLAY_RATINGS.includes(
      candidate.preferredRating as CollectionListDisplayPreferencesModel['preferredRating']
    ) &&
    typeof candidate.imdbRatingFallback === 'boolean'
  );
};

const isValidUserSettings = (body: unknown): body is UserSettingsApiRequestModel => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;

  const candidate = body as Record<string, unknown>;

  return Object.entries(candidate).every(([key, value]) => {
    switch (key) {
      case 'theme':
        return isAllowedTheme(value);
      case 'animatedBackground':
        return isAllowedBoolean(value);
      case 'language':
        return isAllowedLanguage(value);
      case 'defaultLibraryOwnerShareCode':
        return isAllowedDefaultLibraryOwnerShareCode(value);
      case 'collectionListDisplayPreferences':
        return isAllowedCollectionListDisplayPreferences(value);
      case 'fromLogin':
        return typeof value === 'boolean';
      default:
        return false;
    }
  });
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/user/settings`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as UserSettingsApiRequestModel;
      if (!isValidUserSettings(body)) return response.code(400).send();

      const db = getDatabase();
      const userConfig = findUserSettings(db, request.usernameHash) || ({} satisfies UserSettingsApiResponseModel);

      if (body.fromLogin) {
        if (body.language && userConfig.language) delete body.language;
        if (body.theme && userConfig.theme) delete body.theme;
      }
      delete body.fromLogin;

      const updatedConfig = { ...userConfig, ...body } satisfies UserSettingsApiResponseModel;
      upsertUserSettings(db, request.usernameHash, updatedConfig);

      response.send(updatedConfig);
    })
  );
};
