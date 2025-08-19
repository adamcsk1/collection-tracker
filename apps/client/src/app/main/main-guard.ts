import { inject } from '@angular/core';
import { MainService } from '@client/main/main-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';

export const mainGuard = () => {
  const main = inject(MainService);
  const webstorage = inject(WebstorageService);

  if (main.hasRequiredConfig()) return true;

  main.loadStoredData();

  if (!main.hasRequiredConfig()) {
    webstorage.clear();
    window.location.href = '/login/';
    return false;
  } else return true;
};
