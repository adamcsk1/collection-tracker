import { computed, inject, Injectable, signal } from '@angular/core';
import { mainStateToken } from '@client/main/main-store';
import { APP_MODES, SEARCH_MODES, SENSITIVE_DATA_STORAGE_MODES } from '@client/settings/settings-const';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { THEMES } from '@services/theme/theme-const';
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
import { LANGUAGES } from '@shared/models/language-model';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
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
    const appMode = parseAllowedValue(this.webstorage.getItem(STORAGE_APP_MODE), APP_MODES);
    const searchMode = parseAllowedValue(this.webstorage.getItem(STORAGE_SEARCH_MODE), SEARCH_MODES);
    const settingsLock = this.webstorage.getItem(STORAGE_SETTINGS_LOCK) === 'true';
    const fetchBatchSize = this.webstorage.getItem(STORAGE_FETCH_BATCH_SIZE);
    const theme = parseAllowedValue(this.webstorage.getItem(STORAGE_THEME), THEMES);
    const sensitiveDataStorage = parseAllowedValue(
      this.webstorage.getItem(STORAGE_SENSITIVE_DATA_STORAGE),
      SENSITIVE_DATA_STORAGE_MODES
    );
    const clearLocalStorageAfterLogout = this.webstorage.getItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT) === 'true';
    const animatedBackground = this.webstorage.getItem(STORAGE_ANIMATED_BACKGROUND) !== 'false';
    const language = parseAllowedValue(this.webstorage.getItem(STORAGE_LANGUAGE), LANGUAGES);

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.mainState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (fetchBatchSize) this.apiState.setState('fetchBatchSize', Number(fetchBatchSize));
    if (theme) this.themeState.setState('theme', theme);
    if (sensitiveDataStorage) this.mainState.setState('sensitiveDataStorage', sensitiveDataStorage);
    if (language) this.mainState.setState('language', language);
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
