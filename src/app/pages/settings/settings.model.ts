export interface SettingsModel {
  token: string;
  apiUrl: string;
  omdbApiKey: string;
  storeCredentials: boolean;
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: 'system' | 'dark' | 'light';
}
