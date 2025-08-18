import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { mainRoutes } from '@login/main/main-routes';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(mainRoutes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideStore(initialApiState, apiStateToken),
    provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
    provideSignalTranslateConfig({ path: './i18n' }),
  ],
};
