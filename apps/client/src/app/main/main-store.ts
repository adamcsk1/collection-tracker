import { SettingsModel } from '@client/settings/settings.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface MainState {
  appMode: SettingsModel['appMode'] | null;
  settingsLock: boolean;
  permissions: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export const initialMainState: MainState = {
  appMode: null,
  settingsLock: false,
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const mainStateToken = createInjectionToken<MainState>('mainState');
