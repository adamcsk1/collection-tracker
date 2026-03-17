import { APP_MODES, SENSITIVE_DATA_STORAGE_MODES } from '@client/settings/settings-const';
import { LanguageModel } from '@shared/models/language-model';
import { SearchModeModel } from '@shared/models/search-mode-model';
import { ThemeModel } from '@shared/models/theme-model';

export interface SettingsModel {
  sensitiveDataStorage: (typeof SENSITIVE_DATA_STORAGE_MODES)[number];
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  fetchBatchSize: number;
  appMode: (typeof APP_MODES)[number];
  theme: ThemeModel;
  settingsLock: boolean;
  language: LanguageModel;
  searchMode: SearchModeModel;
}
