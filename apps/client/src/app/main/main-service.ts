import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { mainStateToken } from './main-store';
import { SENSITIVE_DATA_STORAGE_MODES } from '../settings/settings-const';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_LOGGED_IN,
  STORAGE_SENSITIVE_DATA_STORAGE,
} from '@shared/constants/storage-const';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
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

    if (apiUrl) this.apiState.setState('apiUrl', apiUrl);
    if (sensitiveDataStorage) this.mainState.setState('sensitiveDataStorage', sensitiveDataStorage);

    this.mainState.setState('clearLocalStorageAfterLogout', clearLocalStorageAfterLogout);
  }

  public validateSession(): void {
    this.api
      .validateSession()
      .pipe(
        catchError(() => {
          this._tokenValid.set(false);
          this.webstorage.removeItem(STORAGE_LOGGED_IN);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this._tokenValid.set(true));
  }
}
