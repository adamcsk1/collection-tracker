import { bootstrapApplication } from '@angular/platform-browser';
import { Main } from '@login/main/main';
import { mainConfig } from '@login/main/main-config';

bootstrapApplication(Main, mainConfig).catch((err) => console.error(err));
