import { computed, inject, Injectable } from '@angular/core';
import { mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_APP_MODE,
  STORAGE_FETCH_BATCH_SIZE,
  STORAGE_OMDB_API_KEY,
  STORAGE_SETTINGS_LOCK,
  STORAGE_THEME,
} from '@shared/constants/storage-const';

@Injectable({ providedIn: 'root' })
export class MainService {
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  public readonly hasRequiredConfig = computed(() => !!this.apiState.state.apiUrl());

  public loadStoredData(): void {
    const apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    const omdbApiKey = this.webstorage.getItem(STORAGE_OMDB_API_KEY);
    const appMode = this.webstorage.getItem(STORAGE_APP_MODE) as SettingsModel['appMode'];
    const settingsLock = this.webstorage.getItem(STORAGE_SETTINGS_LOCK) === 'true';
    const fetchBatchSize = this.webstorage.getItem(STORAGE_FETCH_BATCH_SIZE);
    const theme = this.webstorage.getItem(STORAGE_THEME) as SettingsModel['theme'];

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.mainState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (fetchBatchSize) this.apiState.setState('fetchBatchSize', Number(fetchBatchSize));
    if (theme) this.themeState.setState('theme', theme);
    this.mainState.setState('settingsLock', settingsLock);
  }

  public setPermissions(): void {
    const appMode = this.mainState.state.appMode() || 'basic';

    this.mainState.setState('permissions', {
      create: ['limited', 'full'].includes(appMode),
      delete: ['full'].includes(appMode),
      update: ['full'].includes(appMode),
    });
  }
}
