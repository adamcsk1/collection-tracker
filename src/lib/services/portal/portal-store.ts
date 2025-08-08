import { createInjectionToken } from 'ngx-simple-signal-store';

export interface PortalState {
  component: unknown;
  inputs: object;
}

export const initialPortalState: PortalState = {
  component: null,
  inputs: {},
};

export const portalStateToken = createInjectionToken<PortalState>('portalState');
