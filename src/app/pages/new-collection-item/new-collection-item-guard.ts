import { inject } from '@angular/core';
import { appStateToken } from '@stores/app-store';

export const newCollectionItemGuard = () => {
  const appState = inject(appStateToken);
  return appState.state.permissions().create;
};
