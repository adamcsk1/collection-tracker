import { TestBed } from '@angular/core/testing';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
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
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainService } from './main-service';

describe('MainService', () => {
  let service: MainService;
  let api: { validateAccessToken: ReturnType<typeof vi.fn> };
  let webstorage: { getItem: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;
  let apiState: NgxSimpleSignalStoreService<typeof initialApiState>;
  let omdbState: NgxSimpleSignalStoreService<typeof initialOMDbState>;
  let themeState: NgxSimpleSignalStoreService<typeof initialThemeState>;

  beforeEach(() => {
    api = { validateAccessToken: vi.fn(() => of(undefined)) };
    webstorage = { getItem: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        MainService,
        { provide: ApiService, useValue: api },
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialOMDbState, omdbStateToken),
        provideStore(initialThemeState, themeStateToken),
      ],
    });

    service = TestBed.inject(MainService);
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<typeof initialApiState>;
    omdbState = TestBed.inject(omdbStateToken) as NgxSimpleSignalStoreService<typeof initialOMDbState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<typeof initialThemeState>;
  });

  it('hydrates stores from web storage and sets permissions', () => {
    webstorage.getItem.mockImplementation((key: string) => {
      switch (key) {
        case STORAGE_API_URL:
          return 'https://api.test';
        case STORAGE_OMDB_API_KEY:
          return 'omdb-key';
        case STORAGE_APP_MODE:
          return 'limited';
        case STORAGE_SEARCH_MODE:
          return 'fuzzy';
        case STORAGE_SETTINGS_LOCK:
          return 'true';
        case STORAGE_FETCH_BATCH_SIZE:
          return '25';
        case STORAGE_THEME:
          return 'dark';
        case STORAGE_SENSITIVE_DATA_STORAGE:
          return 'session';
        case STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT:
          return 'true';
        case STORAGE_ANIMATED_BACKGROUND:
          return 'false';
        case STORAGE_LANGUAGE:
          return 'en';
        default:
          return null;
      }
    });
    const setPermissionsSpy = vi.spyOn(service, 'setPermissions');

    service.loadStoredData();

    expect(apiState.state.apiUrl()).toBe('https://api.test');
    expect(omdbState.state.apiKey()).toBe('omdb-key');
    expect(mainState.state.appMode()).toBe('limited');
    expect(mainState.state.settingsLock()).toBe(true);
    expect(apiState.state.fetchBatchSize()).toBe(25);
    expect(themeState.state.theme()).toBe('dark');
    expect(mainState.state.sensitiveDataStorage()).toBe('session');
    expect(mainState.state.clearLocalStorageAfterLogout()).toBe(true);
    expect(mainState.state.animatedBackground()).toBe(false);
    expect(mainState.state.language()).toBe('en');
    expect(mainState.state.searchMode()).toBe('fuzzy');
    expect(setPermissionsSpy).toHaveBeenCalled();
  });

  it('ignores invalid union values from storage', () => {
    webstorage.getItem.mockImplementation((key: string) => {
      switch (key) {
        case STORAGE_APP_MODE:
          return 'invalid';
        case STORAGE_SEARCH_MODE:
          return 'invalid';
        case STORAGE_THEME:
          return 'invalid';
        case STORAGE_SENSITIVE_DATA_STORAGE:
          return 'invalid';
        case STORAGE_LANGUAGE:
          return 'es';
        default:
          return null;
      }
    });
    const setPermissionsSpy = vi.spyOn(service, 'setPermissions');

    service.loadStoredData();

    expect(mainState.state.appMode()).toBe(initialMainState.appMode);
    expect(mainState.state.searchMode()).toBe(initialMainState.searchMode);
    expect(themeState.state.theme()).toBe(initialThemeState.theme);
    expect(mainState.state.sensitiveDataStorage()).toBe(initialMainState.sensitiveDataStorage);
    expect(mainState.state.language()).toBe(initialMainState.language);
    expect(setPermissionsSpy).not.toHaveBeenCalled();
  });

  it('sets permissions based on app mode', () => {
    mainState.setState('appMode', 'basic');
    service.setPermissions();
    expect(mainState.state.permissions()).toEqual({ create: false, update: false, delete: false });

    mainState.setState('appMode', 'limited');
    service.setPermissions();
    expect(mainState.state.permissions()).toEqual({ create: true, update: false, delete: false });

    mainState.setState('appMode', 'full');
    service.setPermissions();
    expect(mainState.state.permissions()).toEqual({ create: true, update: true, delete: true });
  });

  it('validates access token and marks it as valid', () => {
    service.validateAccessToken();
    expect(service.tokenValid()).toBe(true);
    expect(api.validateAccessToken).toHaveBeenCalled();
  });

  it('marks token as invalid when validation fails and rethrows the error', () => {
    api.validateAccessToken.mockReturnValue(throwError(() => new Error('fail')));

    expect(() => service.validateAccessToken()).not.toThrow();
    expect(service.tokenValid()).toBe(false);
  });
});
