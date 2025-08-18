import { inject } from '@angular/core';
import { SettingsService } from '@client/settings/settings-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';

export const mainGuard = () => {
  const settings = inject(SettingsService);
  const webstorage = inject(WebstorageService);

  if (settings.hasSettings()) return true;

  settings.loadStoredData();

  if (!settings.hasSettings()) {
    webstorage.clear();
    window.location.href = '/login/';
    return false;
  } else return true;
};
