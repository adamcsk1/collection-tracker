import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { mainStateToken } from '@client/main/main-store';
import { Observable, of } from 'rxjs';

export const settingsLockedGuard: CanActivateFn = (): Observable<boolean> => {
  const mainState = inject(mainStateToken);
  return of(!mainState.state.settingsLock());
};
