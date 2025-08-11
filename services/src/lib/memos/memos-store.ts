import { MemosLoadNetworkStatus } from '@services/memos/memos-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

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
