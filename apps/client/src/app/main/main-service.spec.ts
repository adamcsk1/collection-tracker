import { TestBed } from '@angular/core/testing';
import { initialMainState, MainState, mainStateToken } from './main-store';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_COLLECTION_FEATURE_PREFERENCES,
  STORAGE_LOGGED_IN,
  STORAGE_SENSITIVE_DATA_STORAGE,
} from '@shared/constants/storage-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainService } from './main-service';

describe('MainService', () => {
  let service: MainService;
  let api: { validateSession: ReturnType<typeof vi.fn> };
  let webstorage: { getItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;

  beforeEach(() => {
    api = { validateSession: vi.fn(() => of(undefined)) };
    webstorage = { getItem: vi.fn(), removeItem: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        MainService,
        { provide: PublicApiService, useValue: api },
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    service = TestBed.inject(MainService);
    mainState = TestBed.inject(mainStateToken);
    apiState = TestBed.inject(apiStateToken);
  });

  it('hydrates browser-backed stores', () => {
    webstorage.getItem.mockImplementation((key: string) => {
      switch (key) {
        case STORAGE_API_URL:
          return 'https://api.test';
        case STORAGE_SENSITIVE_DATA_STORAGE:
          return 'session';
        case STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT:
          return 'true';
        default:
          return null;
      }
    });

    service.loadStoredData();

    expect(apiState.state.apiUrl()).toBe('https://api.test');
    expect(mainState.state.sensitiveDataStorage()).toBe('session');
    expect(mainState.state.clearLocalStorageAfterLogout()).toBe(true);
  });

  it('ignores invalid union values from storage', () => {
    webstorage.getItem.mockImplementation((key: string) => {
      switch (key) {
        case STORAGE_SENSITIVE_DATA_STORAGE:
          return 'invalid';
        default:
          return null;
      }
    });

    service.loadStoredData();

    expect(mainState.state.sensitiveDataStorage()).toBe(initialMainState.sensitiveDataStorage);
  });

  it('hydrates collection feature preferences from the local cache', () => {
    const preferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      tracking: true,
    };
    webstorage.getItem.mockImplementation((key: string) =>
      key === STORAGE_COLLECTION_FEATURE_PREFERENCES ? JSON.stringify(preferences) : null
    );

    service.loadStoredData();

    expect(webstorage.getItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES, 'local');
    expect(mainState.state.collectionFeaturePreferences()).toEqual(preferences);
  });

  it('hydrates collection feature preferences from the configured session cache', () => {
    const preferences = {
      books: false,
      wishlist: true,
      watchlist: false,
      tracking: true,
    };
    webstorage.getItem.mockImplementation((key: string, storage?: string) => {
      if (key === STORAGE_SENSITIVE_DATA_STORAGE) return 'session';
      if (key === STORAGE_COLLECTION_FEATURE_PREFERENCES && storage === 'session') {
        return JSON.stringify(preferences);
      }
      return null;
    });

    service.loadStoredData();

    expect(webstorage.getItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES, 'session');
    expect(mainState.state.collectionFeaturePreferences()).toEqual(preferences);
  });

  it.each(['not-json', JSON.stringify({ wishlist: false })])(
    'uses default collection feature preferences for malformed cached value %s',
    (storedPreferences) => {
      webstorage.getItem.mockImplementation((key: string) =>
        key === STORAGE_COLLECTION_FEATURE_PREFERENCES ? storedPreferences : null
      );

      service.loadStoredData();

      expect(mainState.state.collectionFeaturePreferences()).toEqual(initialMainState.collectionFeaturePreferences);
    }
  );

  it('uses default collection feature preferences when the local cache is missing', () => {
    service.loadStoredData();

    expect(mainState.state.collectionFeaturePreferences()).toEqual(initialMainState.collectionFeaturePreferences);
  });

  it('validates access token and marks it as valid', () => {
    service.validateSession();
    expect(service.tokenValid()).toBe(true);
    expect(api.validateSession).toHaveBeenCalled();
  });

  it('marks token as invalid and clears logged-in flag when validation fails', () => {
    api.validateSession.mockReturnValue(throwError(() => new Error('fail')));

    expect(() => service.validateSession()).not.toThrow();
    expect(service.tokenValid()).toBe(false);
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_LOGGED_IN);
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES);
  });

  it('preserves the logged-in session when validation is rate limited', () => {
    api.validateSession.mockReturnValue(throwError(() => ({ status: 429 })));

    service.validateSession();

    expect(service.tokenValid()).toBe(true);
    expect(webstorage.removeItem).not.toHaveBeenCalled();
  });
});
