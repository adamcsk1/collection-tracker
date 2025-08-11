import { createInjectionToken } from 'ngx-simple-signal-store';

export interface SpinnerLoadingState {
  show: boolean;
}

export const initialSpinnerLoadingState: SpinnerLoadingState = {
  show: false,
};

export const spinnerLoadingStateToken = createInjectionToken<SpinnerLoadingState>('spinnerLoadingState');
