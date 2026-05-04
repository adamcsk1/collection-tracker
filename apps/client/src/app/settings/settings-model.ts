import { APP_MODES, SENSITIVE_DATA_STORAGE_MODES } from './settings-const';
import { LanguageModel } from '@shared/models/language-model';
import { ThemeModel } from '@shared/models/theme-model';

export interface SettingsModel {
  sensitiveDataStorage: (typeof SENSITIVE_DATA_STORAGE_MODES)[number];
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  appMode: (typeof APP_MODES)[number];
  theme: ThemeModel;
  settingsLock: boolean;
  language: LanguageModel;
}
