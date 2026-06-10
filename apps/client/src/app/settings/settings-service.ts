import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_USE_AI_SEARCH,
} from '@shared/constants/storage-const';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
  DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
} from '@shared/models/collection-list-display-preferences-model';
import { UserSettingsApiRequestModel } from '@shared/models/api-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, map, Observable, of, switchMap, tap } from 'rxjs';
import { mainStateToken } from '../main/main-store';
import { sharesStateToken } from '../shares/shares-store';
import { SettingsModel } from './settings-model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  private readonly sharedApi = inject(SharedApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly destroyRef = inject(DestroyRef);

  public preloadUserSettings(): Observable<void> {
    return this.api.getUserSettings().pipe(
      tap((settings) => this.applyUserSettings(settings)),
      switchMap(() =>
        this.api.getAiAvailable().pipe(
          tap((result) => this.applyAiAvailable(result)),
          catchError(() => {
            this.applyAiAvailable({ aiAvailable: false });
            return of({ aiAvailable: false });
          })
        )
      ),
      switchMap(() =>
        this.api.getShares().pipe(
          tap((result) => {
            this.sharesState.setState('loaded', true);
            this.sharesState.setState('userShareCode', result.userShareCode);
            this.sharesState.setState('outgoing', result.outgoing);
            this.sharesState.setState('incoming', result.incoming);
          }),
          catchError(() => {
            this.sharesState.setState('loaded', true);
            return of({ userShareCode: '', outgoing: [], incoming: [] });
          })
        )
      ),
      map(() => void 0)
    );
  }

  private applyUserSettings(settings: {
    theme?: string;
    animatedBackground?: boolean;
    language?: string;
    defaultLibraryOwnerShareCode?: string | null;
    collectionListDisplayPreferences?: Partial<CollectionListDisplayPreferencesModel>;
  }): void {
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

    if (settings.defaultLibraryOwnerShareCode !== undefined) {
      this.mainState.setState('defaultLibraryOwnerShareCode', settings.defaultLibraryOwnerShareCode);
    }

    if (settings.collectionListDisplayPreferences) {
      this.mainState.setState(
        'collectionListDisplayPreferences',
        this.normalizeCollectionListDisplayPreferences(settings.collectionListDisplayPreferences)
      );
    }
  }

  private normalizeCollectionListDisplayPreferences(
    preferences: Partial<CollectionListDisplayPreferencesModel>
  ): CollectionListDisplayPreferencesModel {
    const preferredRating = COLLECTION_LIST_DISPLAY_RATINGS.find((rating) => rating === preferences.preferredRating);
    return {
      showYear:
        typeof preferences.showYear === 'boolean'
          ? preferences.showYear
          : DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES.showYear,
      showSharedIcon:
        typeof preferences.showSharedIcon === 'boolean'
          ? preferences.showSharedIcon
          : DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES.showSharedIcon,
      preferredRating: preferredRating ?? DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES.preferredRating,
      imdbRatingFallback:
        typeof preferences.imdbRatingFallback === 'boolean'
          ? preferences.imdbRatingFallback
          : DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES.imdbRatingFallback,
    };
  }

  private applyAiAvailable(result: { aiAvailable: boolean }): void {
    this.mainState.setState('aiAvailable', result.aiAvailable);
    if (!result.aiAvailable) this.webstorage.removeItem(STORAGE_USE_AI_SEARCH);
  }

  public storeFormData(formData: SettingsModel): void {
    this.mainState.setState('sensitiveDataStorage', formData.sensitiveDataStorage);
    this.mainState.setState('clearLocalStorageAfterLogout', formData.clearLocalStorageAfterLogout);
    this.mainState.setState('animatedBackground', formData.animatedBackground);
    this.mainState.setState('language', formData.language);
    this.themeState.setState('theme', formData.theme);

    this.webstorage.setItem(STORAGE_SENSITIVE_DATA_STORAGE, formData.sensitiveDataStorage);
    this.webstorage.setItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, String(formData.clearLocalStorageAfterLogout));
    this.ngxSignalTranslate.setLanguage(formData.language);

    const userSettings: UserSettingsApiRequestModel = {
      theme: formData.theme,
      animatedBackground: formData.animatedBackground,
      language: formData.language,
    };

    this.sharedApi
      .updateUserSettings(userSettings)
      .pipe(
        tap(() => this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'))),
        map(() => void 0),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public storeDefaultLibraryOwnerShareCode(defaultLibraryOwnerShareCode: string | null): void {
    this.mainState.setState('defaultLibraryOwnerShareCode', defaultLibraryOwnerShareCode);

    this.sharedApi
      .updateUserSettings({ defaultLibraryOwnerShareCode })
      .pipe(
        tap(() => this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'))),
        map(() => void 0),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  public storeCollectionListDisplayPreferences(preferences: CollectionListDisplayPreferencesModel): void {
    this.mainState.setState('collectionListDisplayPreferences', preferences);

    this.sharedApi
      .updateUserSettings({ collectionListDisplayPreferences: preferences })
      .pipe(
        tap(() => this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'))),
        map(() => void 0),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
