import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { mainRoutes } from './main-routes';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(mainRoutes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideStore(initialApiState, apiStateToken),
    provideStore(initialToastState, toastStateToken),
    provideStore(initialThemeState, themeStateToken),
    provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
    provideSignalTranslateConfig({ path: './login/i18n' }),
  ],
};
