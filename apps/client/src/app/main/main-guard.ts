import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { mainStateToken } from '@client/main/main-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { debounceTime, Observable, of } from 'rxjs';

export const mainGuard: CanActivateFn = (): Observable<boolean> => {
  const main = inject(MainService);
  const webstorage = inject(WebstorageService);
  const mainState = inject(mainStateToken);

  if (main.tokenValid()) return of(true);

  const tokenValid$ = toObservable(main.tokenValid).pipe(debounceTime(250)) as unknown as Observable<boolean>;

  if (main.hasRequiredConfig()) {
    main.validateAccessToken();
    return tokenValid$;
  }

  main.loadStoredData();

  if (!main.hasRequiredConfig()) {
    if (mainState.state.clearLocalStorageAfterLogout()) webstorage.clear();
    window.location.href = '/login/';
    return of(false);
  } else {
    main.validateAccessToken();
    return tokenValid$;
  }
};
