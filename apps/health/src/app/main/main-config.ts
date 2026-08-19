import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { refreshTokenInterceptor } from '@services/api/refresh-token-interceptor';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([refreshTokenInterceptor])),
    provideStore(initialApiState, apiStateToken),
    provideSignalTranslateConfig({ path: `${getBasePath()}/health/i18n` }),
  ],
};
