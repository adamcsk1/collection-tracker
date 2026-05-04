import { ApiLoadNetworkStatus } from './api-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ApiState {
  apiUrl: string;
  loadNetworkStatus: ApiLoadNetworkStatus;
}

export const initialApiState: ApiState = {
  apiUrl: '',
  loadNetworkStatus: null,
};

export const apiStateToken = createInjectionToken<ApiState>('apiState');
