import { Themes } from '@lib/services/theme/theme-model';

export interface SettingsModel {
  token: string;
  apiUrl: string;
  omdbApiKey: string;
  storeCredentials: boolean;
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: Themes;
}
