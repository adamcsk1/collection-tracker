import { SettingsModel } from '@settings/settings.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface AppState {
  appMode: SettingsModel['appMode'] | null;
  settingsLock: boolean;
  permissions: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export const initialAppState: AppState = {
  appMode: null,
  settingsLock: false,
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const appStateToken = createInjectionToken<AppState>('appState');
