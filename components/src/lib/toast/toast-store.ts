import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ToastState {
  message: string;
  timeout: number;
}

export const initialToastState: ToastState = {
  message: '',
  timeout: 2500,
};

export const toastStateToken = createInjectionToken<ToastState>('toastState');
