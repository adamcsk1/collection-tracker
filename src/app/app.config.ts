import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from '@appRoutes';
import { appStateToken, initialAppState } from '@stores/app-store';
import { collectionStateToken, initialCollectionState } from '@stores/collection-store';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideStore(initialAppState, appStateToken),
    provideStore(initialCollectionState, collectionStateToken),
    provideSignalTranslateConfig({ path: './i18n' }),
  ],
};
