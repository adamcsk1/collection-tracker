import { Themes } from '@lib/services/theme/theme-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface ThemeState {
  theme: Themes;
}

export const initialThemeState: ThemeState = {
  theme: 'system',
};

export const themeStateToken = createInjectionToken<ThemeState>('themeState');
