import { CanActivateFn } from '@angular/router';

export const settingsLockedGuard: CanActivateFn = (): boolean => {
  return true;
};
