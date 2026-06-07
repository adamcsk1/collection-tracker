import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { initialMainCollectionState, mainCollectionStateToken } from './main-collection-store';
import { initialMainState, mainStateToken } from './main-store';
import { initialSharesState, sharesStateToken } from '../shares/shares-store';
import { initialTagManagementState, tagManagementStateToken } from '../tag-management/tag-management-store';
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
import { refreshTokenInterceptor } from '@services/api/refresh-token-interceptor';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { routes } from './main-routes';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch(), withInterceptors([refreshTokenInterceptor])),
    provideStore(initialThemeState, themeStateToken),
    provideStore(initialToastState, toastStateToken),
    provideStore(initialApiState, apiStateToken),
    provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
    provideStore(initialMainState, mainStateToken),
    provideStore(initialMainCollectionState, mainCollectionStateToken),
    provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
    provideStore(initialSharesState, sharesStateToken),
    provideStore(initialTagManagementState, tagManagementStateToken),
    provideSignalTranslateConfig({ path: `${getBasePath()}/client/i18n` }),
  ],
};
