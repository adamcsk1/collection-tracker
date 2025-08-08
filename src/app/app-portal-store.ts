import { createInjectionToken } from 'ngx-simple-signal-store';

export interface AppPortalState {
  component: unknown;
  inputs: object;
}

export const initialAppPortalState: AppPortalState = {
  component: null,
  inputs: {},
};

export const appPortalStateToken = createInjectionToken<AppPortalState>('appPortalState');
