import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { refreshTokenInterceptor } from '@services/api/refresh-token-interceptor';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { MessageDialog } from '@components/message-dialog/message-dialog';
import { MESSAGE_DIALOG_COMPONENT } from '@services/message-dialog-const';

export const mainConfig: ApplicationConfig = {
  providers: [
    { provide: MESSAGE_DIALOG_COMPONENT, useValue: MessageDialog },
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([refreshTokenInterceptor])),
    provideStore(initialApiState, apiStateToken),
    provideSignalTranslateConfig({ path: `${getBasePath()}/health/i18n` }),
  ],
};
