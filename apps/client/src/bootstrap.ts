import { bootstrapApplication } from '@angular/platform-browser';
import { Main } from '@client/main/main';
import { mainConfig } from '@client/main/main-config';

bootstrapApplication(Main, mainConfig).catch((err) => console.error(err));
