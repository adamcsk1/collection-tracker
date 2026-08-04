import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { initialMainState, MainState, mainStateToken } from '../main/main-store';
import { SettingsModel } from './settings-model';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { SharedApiService } from '@services/api/shared-api-service';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_COLLECTION_FEATURE_PREFERENCES,
  STORAGE_SENSITIVE_DATA_STORAGE,
} from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings-service';
import { initialSharesState, sharesStateToken } from '../shares/shares-store';

const buildFormData = (overrides: Partial<SettingsModel> = {}): SettingsModel => ({
  sensitiveDataStorage: 'local',
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
  language: 'en',
  theme: 'dark',
  ...overrides,
});

describe('SettingsService', () => {
  let service: SettingsService;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let webstorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let api: {
    getUserSettings: ReturnType<typeof vi.fn>;
    getAiAvailable: ReturnType<typeof vi.fn>;
    getShares: ReturnType<typeof vi.fn>;
  };
  let sharedApi: { updateUserSettings: ReturnType<typeof vi.fn> };
  let translate: { translate: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;

  beforeEach(() => {
    router = { navigate: vi.fn() };
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    api = {
      getUserSettings: vi.fn(() => of({})),
      getAiAvailable: vi.fn(() => of({ aiAvailable: false })),
      getShares: vi.fn(() => of({ userShareCode: 'code', outgoing: [], incoming: [] })),
    };
    sharedApi = { updateUserSettings: vi.fn(() => of(void 0)) };
    translate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: Router, useValue: router },
        { provide: ApiService, useValue: api },
        { provide: SharedApiService, useValue: sharedApi },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(SettingsService);
    mainState = TestBed.inject(mainStateToken);
  });

  it('stores form data, syncs settings to the API', () => {
    const formData = buildFormData({ sensitiveDataStorage: 'session' });

    service.storeFormData(formData);

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SENSITIVE_DATA_STORAGE, 'session');
    expect(webstorage.setItem).toHaveBeenCalledWith(
      STORAGE_COLLECTION_FEATURE_PREFERENCES,
      JSON.stringify(initialMainState.collectionFeaturePreferences),
      'session'
    );
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES, 'local');
    expect(sharedApi.updateUserSettings).toHaveBeenCalledWith({
      theme: 'dark',
      animatedBackground: true,
      language: 'en',
    });
    expect(translate.setLanguage).toHaveBeenCalledWith('en');
  });

  it('writes all configuration values to storage', () => {
    const formData = buildFormData({
      clearLocalStorageAfterLogout: true,
      animatedBackground: false,
    });

    service.storeFormData(formData);

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, 'true');
    expect(sharedApi.updateUserSettings).toHaveBeenCalledWith({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });
  });

  it('moves the feature cache from session storage to local storage when the mode changes', () => {
    const preferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      watched: true,
      watching: false,
    };
    mainState.setState('sensitiveDataStorage', 'session');
    mainState.setState('collectionFeaturePreferences', preferences);

    service.storeFormData(buildFormData({ sensitiveDataStorage: 'local' }));

    expect(webstorage.setItem).toHaveBeenCalledWith(
      STORAGE_COLLECTION_FEATURE_PREFERENCES,
      JSON.stringify(preferences),
      'local'
    );
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES, 'session');
  });

  it('preloads migrated settings from the API and leaves defaults for missing values', () => {
    api.getUserSettings.mockReturnValue(
      of({
        theme: 'dark',
      })
    );

    service.preloadUserSettings().subscribe();

    expect(translate.setLanguage).not.toHaveBeenCalled();
    expect(mainState.state.language()).toBe('en');
    expect(mainState.state.animatedBackground()).toBe(true);
    expect(api.getAiAvailable).toHaveBeenCalled();
  });

  it('preloads collection list display preferences from the API', () => {
    api.getUserSettings.mockReturnValue(
      of({
        collectionListDisplayPreferences: {
          showYear: false,
          showSharedIcon: false,
          preferredRating: 'metacritic',
          imdbRatingFallback: true,
        },
      })
    );

    service.preloadUserSettings().subscribe();

    expect(mainState.state.collectionListDisplayPreferences()).toEqual({
      showYear: false,
      showSharedIcon: false,
      preferredRating: 'metacritic',
      imdbRatingFallback: true,
    });
  });

  it('overrides cached collection feature preferences with API preferences', () => {
    const cachedPreferences = {
      books: true,
      wishlist: true,
      watchlist: true,
      watched: true,
      watching: true,
    };
    const apiPreferences = {
      books: false,
      wishlist: false,
      watchlist: true,
      watched: false,
      watching: true,
    };
    mainState.setState('collectionFeaturePreferences', cachedPreferences);
    api.getUserSettings.mockReturnValue(of({ collectionFeaturePreferences: apiPreferences }));

    service.preloadUserSettings().subscribe();

    expect(mainState.state.collectionFeaturePreferences()).toEqual(apiPreferences);
    expect(
      JSON.parse(
        webstorage.setItem.mock.calls.find((call) => call[0] === STORAGE_COLLECTION_FEATURE_PREFERENCES)?.[1] as string
      )
    ).toEqual(apiPreferences);
  });

  it('uses and caches default collection feature preferences when the API field is missing', () => {
    mainState.setState('collectionFeaturePreferences', {
      books: false,
      wishlist: false,
      watchlist: false,
      watched: false,
      watching: false,
    });

    service.preloadUserSettings().subscribe();

    expect(mainState.state.collectionFeaturePreferences()).toEqual(initialMainState.collectionFeaturePreferences);
    expect(webstorage.setItem).toHaveBeenCalledWith(
      STORAGE_COLLECTION_FEATURE_PREFERENCES,
      JSON.stringify(initialMainState.collectionFeaturePreferences),
      'local'
    );
  });

  it('stores collection list display preferences', () => {
    const preferences = {
      showYear: false,
      showSharedIcon: true,
      preferredRating: 'user' as const,
      imdbRatingFallback: true,
    };

    service.storeCollectionListDisplayPreferences(preferences);

    expect(mainState.state.collectionListDisplayPreferences()).toEqual(preferences);
    expect(sharedApi.updateUserSettings).toHaveBeenCalledWith({ collectionListDisplayPreferences: preferences });
  });

  it('stores, caches, and posts collection feature preferences', () => {
    const preferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      watched: false,
      watching: true,
    };

    service.storeCollectionFeaturePreferences(preferences);

    expect(mainState.state.collectionFeaturePreferences()).toEqual(preferences);
    expect(
      JSON.parse(
        webstorage.setItem.mock.calls.find((call) => call[0] === STORAGE_COLLECTION_FEATURE_PREFERENCES)?.[1] as string
      )
    ).toEqual(preferences);
    expect(sharedApi.updateUserSettings).toHaveBeenCalledWith({ collectionFeaturePreferences: preferences });
  });

  it('caches collection feature preferences in configured session storage', () => {
    const preferences = {
      books: false,
      wishlist: true,
      watchlist: false,
      watched: true,
      watching: false,
    };
    mainState.setState('sensitiveDataStorage', 'session');

    service.storeCollectionFeaturePreferences(preferences);

    expect(
      JSON.parse(
        webstorage.setItem.mock.calls.find((call) => call[0] === STORAGE_COLLECTION_FEATURE_PREFERENCES)?.[1] as string
      )
    ).toEqual(preferences);
    expect(webstorage.setItem).toHaveBeenCalledWith(
      STORAGE_COLLECTION_FEATURE_PREFERENCES,
      expect.any(String),
      'session'
    );
  });

  it('serializes collection feature preference updates', () => {
    const firstUpdate = new Subject<void>();
    const firstPreferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      watched: true,
      watching: true,
    };
    const secondPreferences = { ...firstPreferences, watchlist: false };
    sharedApi.updateUserSettings.mockReturnValueOnce(firstUpdate).mockReturnValueOnce(of(void 0));

    service.storeCollectionFeaturePreferences(firstPreferences);
    service.storeCollectionFeaturePreferences(secondPreferences);

    expect(sharedApi.updateUserSettings).toHaveBeenCalledTimes(1);
    firstUpdate.complete();
    expect(sharedApi.updateUserSettings).toHaveBeenCalledTimes(2);
    expect(sharedApi.updateUserSettings).toHaveBeenLastCalledWith({
      collectionFeaturePreferences: secondPreferences,
    });
  });

  it('continues serialized collection feature preference updates after an error', () => {
    const firstPreferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      watched: true,
      watching: true,
    };
    const secondPreferences = { ...firstPreferences, watchlist: false };
    sharedApi.updateUserSettings
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of(void 0));

    service.storeCollectionFeaturePreferences(firstPreferences);
    service.storeCollectionFeaturePreferences(secondPreferences);

    expect(sharedApi.updateUserSettings).toHaveBeenCalledTimes(2);
    expect(sharedApi.updateUserSettings).toHaveBeenLastCalledWith({
      collectionFeaturePreferences: secondPreferences,
    });
  });

  it('updates AI availability when preloaded AI availability reports unavailable', () => {
    mainState.setState('aiAvailable', true);
    api.getAiAvailable.mockReturnValue(of({ aiAvailable: false }));

    service.preloadUserSettings().subscribe();

    expect(mainState.state.aiAvailable()).toBe(false);
  });

  it('updates AI availability when AI availability check fails', () => {
    mainState.setState('aiAvailable', true);
    api.getAiAvailable.mockReturnValue(throwError(() => new Error('network')));

    service.preloadUserSettings().subscribe();

    expect(mainState.state.aiAvailable()).toBe(false);
  });
});
