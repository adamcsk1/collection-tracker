import { bootstrapApplication } from '@angular/platform-browser';
import { Main } from './app/main/main';
import { mainConfig } from './app/main/main-config';

bootstrapApplication(Main, mainConfig).catch((err) => console.error(err));
