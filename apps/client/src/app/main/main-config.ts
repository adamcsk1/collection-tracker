import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { initialTagConfigsState, tagConfigsStateToken } from '@client/tag-configs/tag-configs-store';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { routes } from './main-routes';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideStore(initialThemeState, themeStateToken),
    provideStore(initialToastState, toastStateToken),
    provideStore(initialApiState, apiStateToken),
    provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
    provideStore(initialMainState, mainStateToken),
    provideStore(initialMainCollectionState, mainCollectionStateToken),
    provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
    provideStore(initialTagConfigsState, tagConfigsStateToken),
    provideSignalTranslateConfig({ path: './client/i18n' }),
  ],
};
