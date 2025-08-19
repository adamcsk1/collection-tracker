import { Themes } from '@services/theme/theme-model';

export interface SettingsModel {
  omdbApiKey: string;
  sensitiveDataStorage: 'local' | 'session';
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: Themes;
  settingsLock: boolean;
}
