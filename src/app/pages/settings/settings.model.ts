export interface SettingsModel {
  token: string;
  apiUrl: string;
  omdbApiKey: string;
  storeCredentials: boolean;
  appMode: 'basic' | 'limited' | 'full';
}
