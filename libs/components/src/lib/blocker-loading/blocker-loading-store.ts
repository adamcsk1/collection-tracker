import { createInjectionToken } from 'ngx-simple-signal-store';

export interface BlockerLoadingState {
  show: boolean;
  withoutDelay: boolean;
}

export const initialBlockerLoadingState: BlockerLoadingState = {
  show: false,
  withoutDelay: false,
};

export const blockerLoadingStateToken = createInjectionToken<BlockerLoadingState>('blockerLoadingState');
