import { inject } from '@angular/core';
import { appStateToken } from '../../app-store';

export const collectionNewItemGuard = () => {
  const appState = inject(appStateToken);
  return appState.state.permissions().create;
};
