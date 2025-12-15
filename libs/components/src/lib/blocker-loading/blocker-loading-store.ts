import { createInjectionToken } from 'ngx-simple-signal-store';

export interface BlockerLoadingState {
  show: boolean;
  withoutDelay: boolean;
  message: string | null;
}

export const initialBlockerLoadingState: BlockerLoadingState = {
  show: false,
  withoutDelay: false,
  message: null,
};

export const blockerLoadingStateToken = createInjectionToken<BlockerLoadingState>('blockerLoadingState');
