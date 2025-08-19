import { SettingsModel } from '@client/settings/settings-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  appMode: SettingsModel['appMode'];
  settingsLock: boolean;
  clearLocalStorageAfterLogout: boolean;
  sensitiveDataStorage: SettingsModel['sensitiveDataStorage'];
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
  sensitiveDataStorage: 'local',
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
