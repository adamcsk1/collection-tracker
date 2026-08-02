import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { initialMainState, mainStateToken } from './main-store';
import { SENSITIVE_DATA_STORAGE_MODES } from '../settings/settings-const';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { isRateLimitError } from '@services/api/http-error-util';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_LOGGED_IN,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_COLLECTION_FEATURE_PREFERENCES,
} from '@shared/constants/storage-const';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { DEFAULT_COLLECTION_FEATURE_PREFERENCES } from '@shared/constants/collection-feature-preferences-const';
import { isCollectionFeaturePreferences } from '@shared/utils/collection-feature-preferences-util';
import { catchError, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MainService {
  private readonly api = inject(PublicApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _tokenValid = signal<boolean | null>(null);
  public readonly hasRequiredConfig = computed(() => !!this.apiState.state.apiUrl());
  public readonly tokenValid = this._tokenValid.asReadonly();

  public loadStoredData(): void {
    const apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    const sensitiveDataStorage = parseAllowedValue(
      this.webstorage.getItem(STORAGE_SENSITIVE_DATA_STORAGE),
      SENSITIVE_DATA_STORAGE_MODES
    );
    const clearLocalStorageAfterLogout = this.webstorage.getItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT) === 'true';
    const collectionFeaturePreferences = this.readCollectionFeaturePreferences(
      sensitiveDataStorage ?? initialMainState.sensitiveDataStorage
    );

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (sensitiveDataStorage) this.mainState.setState('sensitiveDataStorage', sensitiveDataStorage);

    this.mainState.setState('clearLocalStorageAfterLogout', clearLocalStorageAfterLogout);
    this.mainState.setState('collectionFeaturePreferences', collectionFeaturePreferences);
  }

  private readCollectionFeaturePreferences(storage: 'local' | 'session') {
    const storedPreferences = this.webstorage.getItem(STORAGE_COLLECTION_FEATURE_PREFERENCES, storage);
    if (!storedPreferences) return DEFAULT_COLLECTION_FEATURE_PREFERENCES;

    try {
      const parsed = JSON.parse(storedPreferences) as unknown;
      return isCollectionFeaturePreferences(parsed) ? parsed : DEFAULT_COLLECTION_FEATURE_PREFERENCES;
    } catch {
      return DEFAULT_COLLECTION_FEATURE_PREFERENCES;
    }
  }

  public validateSession(): void {
    this.api
      .validateSession()
      .pipe(
        catchError((error: unknown) => {
          if (isRateLimitError(error)) {
            this._tokenValid.set(true);
            return EMPTY;
          }
          this._tokenValid.set(false);
          this.webstorage.removeItem(STORAGE_LOGGED_IN);
          this.webstorage.removeItem(STORAGE_COLLECTION_FEATURE_PREFERENCES);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this._tokenValid.set(true));
  }
}
