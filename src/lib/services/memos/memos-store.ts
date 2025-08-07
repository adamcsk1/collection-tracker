import { createInjectionToken } from 'ngx-simple-signal-store';
import { MemosLoadNetworkStatus } from './memos-model';

export interface MemosState {
  token: string;
  apiUrl: string;
  fetchBatchSize: number | null;
  loadNetworkStatus: MemosLoadNetworkStatus;
}

export const initialMemosState: MemosState = {
  token: '',
  apiUrl: '',
  fetchBatchSize: null,
  loadNetworkStatus: null,
};

export const memosStateToken = createInjectionToken<MemosState>('memosState');
