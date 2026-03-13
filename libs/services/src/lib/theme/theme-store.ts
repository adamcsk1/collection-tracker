import { ThemeModel } from '@shared/models/theme-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ThemeState {
  theme: ThemeModel;
}

export const initialThemeState: ThemeState = {
  theme: 'light',
};

export const themeStateToken = createInjectionToken<ThemeState>('themeState');
