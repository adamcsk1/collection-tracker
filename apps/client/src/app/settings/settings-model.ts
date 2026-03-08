import { APP_MODES, SEARCH_MODES, SENSITIVE_DATA_STORAGE_MODES } from '@client/settings/settings-const';
import { Themes } from '@services/theme/theme-model';
import { LanguageModel } from '@shared/models/language-model';

export interface SettingsModel {
  omdbApiKey: string;
  sensitiveDataStorage: (typeof SENSITIVE_DATA_STORAGE_MODES)[number];
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  fetchBatchSize: number;
  appMode: (typeof APP_MODES)[number];
  theme: Themes;
  settingsLock: boolean;
  language: LanguageModel;
  searchMode: (typeof SEARCH_MODES)[number];
}
