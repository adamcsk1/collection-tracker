import { SettingsModel } from '../settings/settings-model';
import { LanguageModel } from '@shared/models/language-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  appMode: SettingsModel['appMode'];
  settingsLock: boolean;
  clearLocalStorageAfterLogout: boolean;
  animatedBackground: boolean;
  sensitiveDataStorage: SettingsModel['sensitiveDataStorage'];
  language: LanguageModel;
  claudeAiAvailable: boolean;
  permissions: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export const initialMainState: MainState = {
  appMode: 'full',
  settingsLock: false,
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  sensitiveDataStorage: 'local',
  language: 'en',
  claudeAiAvailable: false,
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
