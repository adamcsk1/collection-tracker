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
  STORAGE_COLLECTION_FEATURE_PREFERENCES,
} from '@shared/constants/storage-const';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
  DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
} from '@shared/models/collection-list-display-preferences-model';
import { UserSettingsApiRequestModel, UserSettingsApiResponseModel } from '@shared/models/api-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { CollectionFeaturePreferencesModel } from '@shared/models/collection-feature-preferences-model';
import { DEFAULT_COLLECTION_FEATURE_PREFERENCES } from '@shared/constants/collection-feature-preferences-const';
import { parseCollectionFeaturePreferences } from '@shared/utils/collection-feature-preferences-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
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
  private readonly collectionFeaturePreferencesQueue: CollectionFeaturePreferencesModel[] = [];
  private collectionFeaturePreferencesSaveInProgress = false;

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

  private applyUserSettings(settings: UserSettingsApiResponseModel): void {
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

    const collectionFeaturePreferences =
      parseCollectionFeaturePreferences(settings.collectionFeaturePreferences) ??
      DEFAULT_COLLECTION_FEATURE_PREFERENCES;
    this.mainState.setState('collectionFeaturePreferences', collectionFeaturePreferences);
    this.cacheCollectionFeaturePreferences(collectionFeaturePreferences);
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
  }

  public storeFormData(formData: SettingsModel): void {
    const previousSensitiveDataStorage = this.mainState.state.sensitiveDataStorage();
    this.mainState.setState('sensitiveDataStorage', formData.sensitiveDataStorage);
    this.mainState.setState('clearLocalStorageAfterLogout', formData.clearLocalStorageAfterLogout);
    this.mainState.setState('animatedBackground', formData.animatedBackground);
    this.mainState.setState('language', formData.language);
    this.themeState.setState('theme', formData.theme);

    this.webstorage.setItem(STORAGE_SENSITIVE_DATA_STORAGE, formData.sensitiveDataStorage);
    this.webstorage.setItem(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, String(formData.clearLocalStorageAfterLogout));
    if (previousSensitiveDataStorage !== formData.sensitiveDataStorage) {
      this.webstorage.setItem(
        STORAGE_COLLECTION_FEATURE_PREFERENCES,
        JSON.stringify(this.mainState.state.collectionFeaturePreferences()),
        formData.sensitiveDataStorage
      );
      this.webstorage.removeItem(STORAGE_COLLECTION_FEATURE_PREFERENCES, previousSensitiveDataStorage);
    }
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

  public storeCollectionFeaturePreferences(preferences: CollectionFeaturePreferencesModel): void {
    const normalized = parseCollectionFeaturePreferences(preferences) ?? DEFAULT_COLLECTION_FEATURE_PREFERENCES;
    this.mainState.setState('collectionFeaturePreferences', normalized);
    this.cacheCollectionFeaturePreferences(normalized);

    this.collectionFeaturePreferencesQueue.push(normalized);
    this.saveNextCollectionFeaturePreferences();
  }

  private saveNextCollectionFeaturePreferences(): void {
    if (this.collectionFeaturePreferencesSaveInProgress) return;

    const preferences = this.collectionFeaturePreferencesQueue.shift();
    if (!preferences) return;

    this.collectionFeaturePreferencesSaveInProgress = true;
    this.sharedApi
      .updateUserSettings({ collectionFeaturePreferences: preferences })
      .pipe(
        tap(() => this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsSaved'))),
        catchError(() => EMPTY),
        finalize(() => {
          this.collectionFeaturePreferencesSaveInProgress = false;
          this.saveNextCollectionFeaturePreferences();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private cacheCollectionFeaturePreferences(preferences: CollectionFeaturePreferencesModel): void {
    this.webstorage.setItem(
      STORAGE_COLLECTION_FEATURE_PREFERENCES,
      JSON.stringify(preferences),
      this.mainState.state.sensitiveDataStorage()
    );
  }
}
