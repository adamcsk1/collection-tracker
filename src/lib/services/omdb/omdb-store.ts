import { createInjectionToken } from 'ngx-simple-signal-store';

export interface OMDbState {
  apiKey: string;
}

export const initialOMDbState: OMDbState = {
  apiKey: '',
};

export const omdbStateToken = createInjectionToken<OMDbState>('omdbState');
