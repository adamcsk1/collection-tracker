import { SettingsModel } from '@pages/settings/settings.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface AppState {
  appMode: SettingsModel['appMode'] | null;
  permissions: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export const initialAppState: AppState = {
  appMode: null,
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const appStateToken = createInjectionToken<AppState>('appState');
