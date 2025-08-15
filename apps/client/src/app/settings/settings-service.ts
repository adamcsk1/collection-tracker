import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { appStateToken } from '@client/app-store';
import {
  SETTINGS_STORAGE_API_URL,
  SETTINGS_STORAGE_APP_MODE,
  SETTINGS_STORAGE_FETCH_BATCH_SIZE,
  SETTINGS_STORAGE_OMDB_API_KEY,
  SETTINGS_STORAGE_SETTINGS_LOCK,
  SETTINGS_STORAGE_THEME,
  SETTINGS_STORAGE_TOKEN,
} from '@client/settings/settings-const';
import { SettingsModel } from '@client/settings/settings.model';
import { toastStateToken } from '@components/toast/toast-store';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly router = inject(Router);
  private readonly webstorage = inject(WebstorageService);
  private readonly appState = inject(appStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly hasSettings = computed(
    () => !!this.apiState.state.token() && !!this.apiState.state.apiUrl() && !!this.omdbState.state.apiKey()
  );

  public loadStoredData(): void {
    const apiToken = this.webstorage.getItem(SETTINGS_STORAGE_TOKEN);
    const apiUrl = this.webstorage.getItem(SETTINGS_STORAGE_API_URL);
    const omdbApiKey = this.webstorage.getItem(SETTINGS_STORAGE_OMDB_API_KEY);
    const appMode = this.webstorage.getItem(SETTINGS_STORAGE_APP_MODE) as SettingsModel['appMode'];
    const settingsLock = this.webstorage.getItem(SETTINGS_STORAGE_SETTINGS_LOCK) === 'true';
    const fetchBatchSize = this.webstorage.getItem(SETTINGS_STORAGE_FETCH_BATCH_SIZE);
    const theme = this.webstorage.getItem(SETTINGS_STORAGE_THEME) as SettingsModel['theme'];

    if (apiToken) this.apiState.setState('token', apiToken);
    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.appState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (fetchBatchSize) this.apiState.setState('fetchBatchSize', Number(fetchBatchSize));
    if (theme) this.themeState.setState('theme', theme);
    this.appState.setState('settingsLock', settingsLock);
  }

  public storeFormData(formData: SettingsModel, navigateBack = false): void {
    this.apiState.setState('token', formData.token);
    this.apiState.setState('apiUrl', formData.apiUrl);
    this.omdbState.setState('apiKey', formData.omdbApiKey);
    this.appState.setState('appMode', formData.appMode);
    this.appState.setState('settingsLock', formData.settingsLock);
    this.apiState.setState('fetchBatchSize', formData.fetchBatchSize);
    this.themeState.setState('theme', formData.theme);

    const storageType = formData.storeCredentials ? 'local' : 'session';
    this.webstorage.setItem(SETTINGS_STORAGE_TOKEN, formData.token, storageType);
    this.webstorage.setItem(SETTINGS_STORAGE_OMDB_API_KEY, formData.omdbApiKey, storageType);

    if (!formData.storeCredentials) {
      this.webstorage.removeItem(SETTINGS_STORAGE_TOKEN, 'local');
      this.webstorage.removeItem(SETTINGS_STORAGE_OMDB_API_KEY, 'local');
    }

    this.webstorage.setItem(SETTINGS_STORAGE_API_URL, formData.apiUrl);
    this.webstorage.setItem(SETTINGS_STORAGE_APP_MODE, formData.appMode);
    this.webstorage.setItem(SETTINGS_STORAGE_SETTINGS_LOCK, String(formData.settingsLock));
    this.webstorage.setItem(SETTINGS_STORAGE_FETCH_BATCH_SIZE, `${formData.fetchBatchSize}`);
    this.webstorage.setItem(SETTINGS_STORAGE_THEME, formData.theme);

    this.setPermissions();

    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'));

    if (navigateBack) this.router.navigate(['/', 'collection']);
  }

  private setPermissions(): void {
    const appMode = this.appState.state.appMode() || 'basic';

    this.appState.setState('permissions', {
      create: ['limited', 'full'].includes(appMode),
      delete: ['full'].includes(appMode),
      update: ['full'].includes(appMode),
    });
  }
}
