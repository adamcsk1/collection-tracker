import { bootstrapApplication } from '@angular/platform-browser';
import { Main } from '@health/main/main';
import { mainConfig } from '@health/main/main-config';

bootstrapApplication(Main, mainConfig).catch((err) => console.error(err));
