import { createInjectionToken } from 'ngx-simple-signal-store';
import { Themes } from './theme-model';

export interface ThemeState {
  theme: Themes;
}

export const initialThemeState: ThemeState = {
  theme: 'system',
};

export const themeStateToken = createInjectionToken<ThemeState>('themeState');
