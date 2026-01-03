import { computed, inject, Injectable, signal } from '@angular/core';
import { mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_ANIMATED_BACKGROUND,
  STORAGE_API_URL,
  STORAGE_APP_MODE,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_FETCH_BATCH_SIZE,
  STORAGE_LANGUAGE,
  STORAGE_OMDB_API_KEY,
  STORAGE_SEARCH_MODE,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_SETTINGS_LOCK,
  STORAGE_THEME,
} from '@shared/constants/storage-const';
import { LanguageModel } from '@shared/models/language-model';
import { catchError, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MainService {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly _tokenValid = signal<boolean | null>(null);
  public readonly hasRequiredConfig = computed(() => !!this.apiState.state.apiUrl());
  public readonly tokenValid = this._tokenValid.asReadonly();

  public loadStoredData(): void {
    const apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    const omdbApiKey = this.webstorage.getItem(STORAGE_OMDB_API_KEY);
    const appMode = this.webstorage.getItem(STORAGE_APP_MODE) as SettingsModel['appMode'];
    const searchMode = this.webstorage.getItem(STORAGE_SEARCH_MODE) as SettingsModel['searchMode'];
    const settingsLock = this.webstorage.getItem(STORAGE_SETTINGS_LOCK) === 'true';
    const fetchBatchSize = this.webstorage.getItem(STORAGE_FETCH_BATCH_SIZE);
    const theme = this.webstorage.getItem(STORAGE_THEME) as SettingsModel['theme'];
    const sensitiveDataStorage = this.webstorage.getItem(
      STORAGE_SENSITIVE_DATA_STORAGE
    ) as SettingsModel['sensitiveDataStorage'];
    const clearLocalStorageAfterLogout = this.webstorage.getItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT) === 'true';
    const animatedBackground = this.webstorage.getItem(STORAGE_ANIMATED_BACKGROUND) !== 'false';
    const language = this.webstorage.getItem(STORAGE_LANGUAGE);

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.mainState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (fetchBatchSize) this.apiState.setState('fetchBatchSize', Number(fetchBatchSize));
    if (theme) this.themeState.setState('theme', theme);
    if (sensitiveDataStorage) this.mainState.setState('sensitiveDataStorage', sensitiveDataStorage);
    if (language) this.mainState.setState('language', language as LanguageModel);
    if (appMode) this.mainState.setState('appMode', appMode);
    if (searchMode) this.mainState.setState('searchMode', searchMode);

    this.mainState.setState('settingsLock', settingsLock);
    this.mainState.setState('clearLocalStorageAfterLogout', clearLocalStorageAfterLogout);
    this.mainState.setState('animatedBackground', animatedBackground);
  }

  public setPermissions(): void {
    const appMode = this.mainState.state.appMode() || 'basic';

    this.mainState.setState('permissions', {
      create: ['limited', 'full'].includes(appMode),
      delete: ['full'].includes(appMode),
      update: ['full'].includes(appMode),
    });
  }

  public validateAccessToken(): void {
    this.api
      .validateAccessToken()
      .pipe(
        catchError(() => {
          this._tokenValid.set(false);
          return EMPTY;
        })
      )
      .subscribe(() => this._tokenValid.set(true));
  }
}
