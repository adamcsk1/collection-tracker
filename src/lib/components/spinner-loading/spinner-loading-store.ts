import { createInjectionToken } from 'ngx-simple-signal-store';

export interface SpinnerLoadingState {
  spinnerLoading: boolean;
}

export const initialSpinnerLoadingState: SpinnerLoadingState = {
  spinnerLoading: false,
};

export const spinnerLoadingStateToken = createInjectionToken<SpinnerLoadingState>('spinnerLoadingState');
