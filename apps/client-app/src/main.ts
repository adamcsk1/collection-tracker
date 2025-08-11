import { bootstrapApplication } from '@angular/platform-browser';
import { App } from '@client-app/app';
import { appConfig } from '@client-app/app-config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
