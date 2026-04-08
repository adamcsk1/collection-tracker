import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn } from '@angular/router';
import { LogoutService } from './logout-service';
import { MainService } from './main-service';
import { debounceTime, filter, Observable, of } from 'rxjs';

export const mainGuard: CanActivateFn = (): Observable<boolean> => {
  const main = inject(MainService);
  const logout = inject(LogoutService);

  if (main.tokenValid()) return of(true);

  const tokenValid$ = toObservable(main.tokenValid).pipe(
    debounceTime(250),
    filter((tokenValid): tokenValid is boolean => tokenValid !== null)
  );

  if (main.hasRequiredConfig()) {
    main.validateAccessToken();
    return tokenValid$;
  }

  main.loadStoredData();

  if (!main.hasRequiredConfig()) {
    logout.performLogout();
    return of(false);
  } else {
    main.validateAccessToken();
    return tokenValid$;
  }
};
