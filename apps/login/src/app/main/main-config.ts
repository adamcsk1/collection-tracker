import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import { mainRoutes } from '@login/main/main-routes';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';

export const mainConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(mainRoutes, withHashLocation()),
    provideHttpClient(withFetch()),
    provideSignalTranslateConfig({ path: './i18n' }),
  ],
};
