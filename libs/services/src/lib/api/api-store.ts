import { ApiLoadNetworkStatus } from '@services/api/api-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ApiState {
  token: string;
  apiUrl: string;
  fetchBatchSize: number | null;
  loadNetworkStatus: ApiLoadNetworkStatus;
}

export const initialApiState: ApiState = {
  token: '',
  apiUrl: '',
  fetchBatchSize: null,
  loadNetworkStatus: null,
};

export const apiStateToken = createInjectionToken<ApiState>('apiState');
