import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { omdbStateToken } from '@lib/services/omdb/omdb-store';
import { themeStateToken } from '@lib/services/theme/theme-store';
import { appStateToken } from '@stores/app-store';
import {
  SETTINGS_LC_API_URL,
  SETTINGS_LC_APP_MODE,
  SETTINGS_LC_FETCH_BATCH_SIZE,
  SETTINGS_LC_OMDB_API_KEY,
  SETTINGS_LC_THEME,
  SETTINGS_LC_TOKEN,
} from './settings.const';
import { SettingsModel } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly router = inject(Router);
  private readonly appState = inject(appStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly memosState = inject(memosStateToken);
  public readonly hasSettings = computed(
    () => !!this.memosState.state.token() && !!this.memosState.state.apiUrl() && !!this.omdbState.state.apiKey()
  );

  public loadStoredData(): void {
    const memosToken = localStorage.getItem(SETTINGS_LC_TOKEN);
    const memosApiUrl = localStorage.getItem(SETTINGS_LC_API_URL);
    const omdbApiKey = localStorage.getItem(SETTINGS_LC_OMDB_API_KEY);
    const appMode = localStorage.getItem(SETTINGS_LC_APP_MODE) as SettingsModel['appMode'];
    const fetchBatchSize = localStorage.getItem(SETTINGS_LC_FETCH_BATCH_SIZE);
    const theme = localStorage.getItem(SETTINGS_LC_THEME) as SettingsModel['theme'];

    if (memosToken) this.memosState.setState('token', memosToken);
    if (memosApiUrl) this.memosState.setState('apiUrl', memosApiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.appState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (fetchBatchSize) this.memosState.setState('fetchBatchSize', Number(fetchBatchSize));
    if (theme) this.themeState.setState('theme', theme);
  }

  public storeFormData(formData: SettingsModel, navigateBack = false): void {
    this.memosState.setState('token', formData.token);
    this.memosState.setState('apiUrl', formData.apiUrl);
    this.omdbState.setState('apiKey', formData.omdbApiKey);
    this.appState.setState('appMode', formData.appMode);
    this.memosState.setState('fetchBatchSize', formData.fetchBatchSize);
    this.themeState.setState('theme', formData.theme);

    if (formData.storeCredentials) {
      localStorage.setItem(SETTINGS_LC_TOKEN, formData.token);
      localStorage.setItem(SETTINGS_LC_API_URL, formData.apiUrl);
      localStorage.setItem(SETTINGS_LC_OMDB_API_KEY, formData.omdbApiKey);
    } else {
      localStorage.removeItem(SETTINGS_LC_TOKEN);
      localStorage.removeItem(SETTINGS_LC_API_URL);
      localStorage.removeItem(SETTINGS_LC_OMDB_API_KEY);
    }

    localStorage.setItem(SETTINGS_LC_APP_MODE, formData.appMode);
    localStorage.setItem(SETTINGS_LC_FETCH_BATCH_SIZE, `${formData.fetchBatchSize}`);
    localStorage.setItem(SETTINGS_LC_THEME, formData.theme);

    this.setPermissions();

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
