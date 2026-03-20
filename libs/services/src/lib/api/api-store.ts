import { ApiLoadNetworkStatus } from '@services/api/api-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ApiState {
  apiUrl: string;
  fetchBatchSize: number;
  loadNetworkStatus: ApiLoadNetworkStatus;
}

export const initialApiState: ApiState = {
  apiUrl: '',
  fetchBatchSize: 500,
  loadNetworkStatus: null,
};

export const apiStateToken = createInjectionToken<ApiState>('apiState');
