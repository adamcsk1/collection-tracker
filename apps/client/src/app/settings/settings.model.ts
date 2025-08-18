import { Themes } from '@services/theme/theme-model';

export interface SettingsModel {
  apiUrl: string;
  omdbApiKey: string;
  storeCredentials: boolean;
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: Themes;
  settingsLock: boolean;
}
