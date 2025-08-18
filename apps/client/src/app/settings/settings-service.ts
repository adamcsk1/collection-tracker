import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings.model';
import { toastStateToken } from '@components/toast/toast-store';
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
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly router = inject(Router);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly hasSettings = computed(() => !!this.apiState.state.apiUrl());

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

  public storeFormData(formData: SettingsModel, navigateBack = false): void {
    this.apiState.setState('apiUrl', formData.apiUrl);
    this.omdbState.setState('apiKey', formData.omdbApiKey);
    this.mainState.setState('appMode', formData.appMode);
    this.mainState.setState('settingsLock', formData.settingsLock);
    this.apiState.setState('fetchBatchSize', formData.fetchBatchSize);
    this.themeState.setState('theme', formData.theme);

    const storageType = formData.storeCredentials ? 'local' : 'session';
    this.webstorage.setItem(STORAGE_OMDB_API_KEY, formData.omdbApiKey, storageType);

    if (!formData.storeCredentials) {
      this.webstorage.removeItem(STORAGE_OMDB_API_KEY, 'local');
    }

    this.webstorage.setItem(STORAGE_API_URL, formData.apiUrl);
    this.webstorage.setItem(STORAGE_APP_MODE, formData.appMode);
    this.webstorage.setItem(STORAGE_SETTINGS_LOCK, String(formData.settingsLock));
    this.webstorage.setItem(STORAGE_FETCH_BATCH_SIZE, `${formData.fetchBatchSize}`);
    this.webstorage.setItem(STORAGE_THEME, formData.theme);

    this.setPermissions();

    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'));

    if (navigateBack) this.router.navigate(['/', 'collection']);
  }

  private setPermissions(): void {
    const appMode = this.mainState.state.appMode() || 'basic';

    this.mainState.setState('permissions', {
      create: ['limited', 'full'].includes(appMode),
      delete: ['full'].includes(appMode),
      update: ['full'].includes(appMode),
    });
  }
}
