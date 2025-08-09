import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appCollectionStateToken, initialAppCollectionState } from '@appCollectionStore';
import { routes } from '@appRoutes';
import { appStateToken, initialAppState } from '@appStore';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@lib/components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@lib/components/toast/toast-store';
import { initialMemosState, memosStateToken } from '@lib/services/memos/memos-store';
import { initialOMDbState, omdbStateToken } from '@lib/services/omdb/omdb-store';
import { initialThemeState, themeStateToken } from '@lib/services/theme/theme-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';

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
