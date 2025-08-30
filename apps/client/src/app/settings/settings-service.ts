import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { toastStateToken } from '@components/toast/toast-store';
import { apiStateToken } from '@services/api/api-store';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_ANIMATED_BACKGROUND,
  STORAGE_APP_MODE,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_FETCH_BATCH_SIZE,
  STORAGE_LANGUAGE,
  STORAGE_OMDB_API_KEY,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_SETTINGS_LOCK,
  STORAGE_THEME,
} from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly router = inject(Router);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly main = inject(MainService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly toastState = inject(toastStateToken);

  public storeFormData(formData: SettingsModel, navigateBack = false): void {
    this.omdbState.setState('apiKey', formData.omdbApiKey);
    this.mainState.setState('appMode', formData.appMode);
    this.mainState.setState('settingsLock', formData.settingsLock === 'true');
    this.mainState.setState('sensitiveDataStorage', formData.sensitiveDataStorage);
    this.mainState.setState('clearLocalStorageAfterLogout', formData.clearLocalStorageAfterLogout === 'true');
    this.mainState.setState('animatedBackground', formData.animatedBackground === 'true');
    this.mainState.setState('language', formData.language);
    this.apiState.setState('fetchBatchSize', formData.fetchBatchSize);
    this.themeState.setState('theme', formData.theme);

    this.webstorage.setItem(STORAGE_SENSITIVE_DATA_STORAGE, formData.sensitiveDataStorage);
    this.webstorage.setItem(STORAGE_OMDB_API_KEY, formData.omdbApiKey, formData.sensitiveDataStorage);
    if (formData.sensitiveDataStorage === 'session') {
      this.webstorage.removeItem(STORAGE_OMDB_API_KEY, 'local');
    }

    this.webstorage.setItem(STORAGE_APP_MODE, formData.appMode);
    this.webstorage.setItem(STORAGE_SETTINGS_LOCK, String(formData.settingsLock));
    this.webstorage.setItem(STORAGE_FETCH_BATCH_SIZE, `${formData.fetchBatchSize}`);
    this.webstorage.setItem(STORAGE_THEME, formData.theme);
    this.webstorage.setItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, String(formData.clearLocalStorageAfterLogout));
    this.webstorage.setItem(STORAGE_ANIMATED_BACKGROUND, String(formData.animatedBackground));
    this.webstorage.setItem(STORAGE_LANGUAGE, formData.language);
    this.ngxSignalTranslate.setLanguage(formData.language);

    this.main.setPermissions();

    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'));

    if (navigateBack) this.router.navigate(['collection']);
  }
}
