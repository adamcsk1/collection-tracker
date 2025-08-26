import { Themes } from '@services/theme/theme-model';
import { StringBooleanModel } from '@shared/models/types-model';

export interface SettingsModel {
  omdbApiKey: string;
  sensitiveDataStorage: 'local' | 'session';
  clearLocalStorageAfterLogout: StringBooleanModel;
  animatedBackground: StringBooleanModel;
  fetchBatchSize: number;
  appMode: 'basic' | 'limited' | 'full';
  theme: Themes;
  settingsLock: StringBooleanModel;
}
