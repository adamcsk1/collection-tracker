import { SettingsModel } from '@pages/settings/settings.model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface AppState {
  memosToken: string;
  memosApiUrl: string;
  omdbApiKey: string;
  spinnerLoading: boolean;
  appMode: SettingsModel['appMode'] | null;
  fetchBatchSize: number | null;
  theme: SettingsModel['theme'];
  permissions: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export const initialAppState: AppState = {
  memosToken: '',
  memosApiUrl: '',
  omdbApiKey: '',
  spinnerLoading: false,
  appMode: null,
  fetchBatchSize: null,
  theme: 'system',
  permissions: {
    create: false,
    update: false,
    delete: false,
  },
};

export const appStateToken = createInjectionToken<AppState>('appState');
