import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_APP_MODE,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_SETTINGS_LOCK,
} from '@shared/constants/storage-const';
import { UserSettingsApiRequestModel } from '@shared/models/api-model';
import { LANGUAGES } from '@shared/models/language-model';
import { SEARCH_MODES } from '@shared/models/search-mode-model';
import { THEMES } from '@shared/models/theme-model';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, map, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly main = inject(MainService);
  private readonly mainState = inject(mainStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly toastState = inject(toastStateToken);

  public preloadUserSettings(): Observable<void> {
    return this.api.getUserSettings().pipe(
      tap((settings) => {
        if (typeof settings.fetchBatchSize === 'number' && Number.isFinite(settings.fetchBatchSize)) {
          this.apiState.setState('fetchBatchSize', settings.fetchBatchSize);
        }

        const theme = parseAllowedValue(settings.theme ?? null, THEMES);
        if (theme) this.themeState.setState('theme', theme);

        if (typeof settings.animatedBackground === 'boolean') {
          this.mainState.setState('animatedBackground', settings.animatedBackground);
        }

        const language = parseAllowedValue(settings.language ?? null, LANGUAGES);
        if (language) {
          this.mainState.setState('language', language);
          this.ngxSignalTranslate.setLanguage(language);
        }

        const searchMode = parseAllowedValue(settings.searchMode ?? null, SEARCH_MODES);
        if (searchMode) this.mainState.setState('searchMode', searchMode);
      }),
      map(() => void 0)
    );
  }

  public storeFormData(formData: SettingsModel, navigateBack = false): void {
    this.mainState.setState('appMode', formData.appMode);
    this.mainState.setState('settingsLock', formData.settingsLock);
    this.mainState.setState('sensitiveDataStorage', formData.sensitiveDataStorage);
    this.mainState.setState('clearLocalStorageAfterLogout', formData.clearLocalStorageAfterLogout);
    this.mainState.setState('animatedBackground', formData.animatedBackground);
    this.mainState.setState('language', formData.language);
    this.mainState.setState('searchMode', formData.searchMode);
    this.apiState.setState('fetchBatchSize', formData.fetchBatchSize);
    this.themeState.setState('theme', formData.theme);

    this.webstorage.setItem(STORAGE_SENSITIVE_DATA_STORAGE, formData.sensitiveDataStorage);
    this.webstorage.setItem(STORAGE_APP_MODE, formData.appMode);
    this.webstorage.setItem(STORAGE_SETTINGS_LOCK, String(formData.settingsLock));
    this.webstorage.setItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, String(formData.clearLocalStorageAfterLogout));
    this.ngxSignalTranslate.setLanguage(formData.language);

    this.main.setPermissions();

    const userSettings: UserSettingsApiRequestModel = {
      searchMode: formData.searchMode,
      fetchBatchSize: formData.fetchBatchSize,
      theme: formData.theme,
      animatedBackground: formData.animatedBackground,
      language: formData.language,
    };

    this.api
      .updateUserSettings(userSettings)
      .pipe(
        tap(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'));

          if (navigateBack) this.router.navigate(['collection']);
        }),
        map(() => void 0),
        catchError(() => EMPTY)
      )
      .subscribe();
  }
}
