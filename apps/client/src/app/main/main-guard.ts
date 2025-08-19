import { inject } from '@angular/core';
import { MainService } from '@client/main/main-service';
import { mainStateToken } from '@client/main/main-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';

export const mainGuard = () => {
  const main = inject(MainService);
  const webstorage = inject(WebstorageService);
  const mainState = inject(mainStateToken);

  if (main.hasRequiredConfig()) return true;

  main.loadStoredData();

  if (!main.hasRequiredConfig()) {
    if (mainState.state.clearLocalStorageAfterLogout()) webstorage.clear();
    window.location.href = '/login/';
    return false;
  } else return true;
};
