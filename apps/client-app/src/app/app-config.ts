import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import { appCollectionStateToken, initialAppCollectionState } from '@client-app/app-collection-store';
import { appStateToken, initialAppState } from '@client-app/app-store';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { initialMemosState, memosStateToken } from '@services/memos/memos-store';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { routes } from './app-routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideStore(initialOMDbState, omdbStateToken),
    provideStore(initialThemeState, themeStateToken),
    provideStore(initialMemosState, memosStateToken),
    provideStore(initialToastState, toastStateToken),
    provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
    provideStore(initialAppState, appStateToken),
    provideStore(initialAppCollectionState, appCollectionStateToken),
    provideSignalTranslateConfig({ path: './i18n' }),
  ],
};
