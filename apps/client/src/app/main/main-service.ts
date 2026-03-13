import { computed, inject, Injectable, signal } from '@angular/core';
import { mainStateToken } from '@client/main/main-store';
import { APP_MODES, SENSITIVE_DATA_STORAGE_MODES } from '@client/settings/settings-const';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_APP_MODE,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_OMDB_API_KEY,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_SETTINGS_LOCK,
} from '@shared/constants/storage-const';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { catchError, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MainService {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly _tokenValid = signal<boolean | null>(null);
  public readonly hasRequiredConfig = computed(() => !!this.apiState.state.apiUrl());
  public readonly tokenValid = this._tokenValid.asReadonly();

  public loadStoredData(): void {
    const apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    const omdbApiKey = this.webstorage.getItem(STORAGE_OMDB_API_KEY);
    const appMode = parseAllowedValue(this.webstorage.getItem(STORAGE_APP_MODE), APP_MODES);
    const settingsLock = this.webstorage.getItem(STORAGE_SETTINGS_LOCK) === 'true';
    const sensitiveDataStorage = parseAllowedValue(
      this.webstorage.getItem(STORAGE_SENSITIVE_DATA_STORAGE),
      SENSITIVE_DATA_STORAGE_MODES
    );
    const clearLocalStorageAfterLogout = this.webstorage.getItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT) === 'true';

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (omdbApiKey) this.omdbState.setState('apiKey', omdbApiKey);
    if (appMode) {
      this.mainState.setState('appMode', appMode);
      this.setPermissions();
    }
    if (sensitiveDataStorage) this.mainState.setState('sensitiveDataStorage', sensitiveDataStorage);
    if (appMode) this.mainState.setState('appMode', appMode);

    this.mainState.setState('settingsLock', settingsLock);
    this.mainState.setState('clearLocalStorageAfterLogout', clearLocalStorageAfterLogout);
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
