import { Themes } from '@services/theme/theme-model';

export interface SettingsModel {
  omdbApiKey: string;
  sensitiveDataStorage: 'local' | 'session';
  clearLocalStorageAfterLogout: 'true' | 'false';
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: Themes;
  settingsLock: boolean;
}
