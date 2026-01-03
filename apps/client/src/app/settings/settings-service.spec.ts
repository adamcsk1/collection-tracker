import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_ANIMATED_BACKGROUND,
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
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings-service';

const buildFormData = (overrides: Partial<SettingsModel> = {}): SettingsModel => ({
  appMode: 'full',
  omdbApiKey: 'omdb-key',
  settingsLock: 'false',
  sensitiveDataStorage: 'local',
  clearLocalStorageAfterLogout: 'false',
  animatedBackground: 'true',
  language: 'en',
  searchMode: 'standard',
  fetchBatchSize: 25,
  theme: 'dark',
  ...overrides,
});

describe('SettingsService', () => {
  let service: SettingsService;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let webstorage: {
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let translate: { translate: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn> };
  let main: { setPermissions: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;

  beforeEach(() => {
    router = { navigate: vi.fn() };
    webstorage = { setItem: vi.fn(), removeItem: vi.fn() };
    translate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };
    main = { setPermissions: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: Router, useValue: router },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: translate },
        { provide: MainService, useValue: main },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialOMDbState, omdbStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(SettingsService);
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;
  });

  it('stores form data including search mode and clears local OMDb key when using session storage', () => {
    const formData = buildFormData({
      searchMode: 'fuzzy',
      sensitiveDataStorage: 'session',
      omdbApiKey: 'secure-key',
    });

    service.storeFormData(formData);

    expect(mainState.state.searchMode()).toBe('fuzzy');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SEARCH_MODE, 'fuzzy');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SENSITIVE_DATA_STORAGE, 'session');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_OMDB_API_KEY, 'secure-key', 'session');
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_OMDB_API_KEY, 'local');
    expect(main.setPermissions).toHaveBeenCalled();
    expect(translate.setLanguage).toHaveBeenCalledWith('en');
  });

  it('navigates back to collection when requested', () => {
    const formData = buildFormData({ searchMode: 'fuzzy' });

    service.storeFormData(formData, true);

    expect(router.navigate).toHaveBeenCalledWith(['collection']);
  });

  it('writes all configuration values to storage', () => {
    const formData = buildFormData({
      appMode: 'limited',
      settingsLock: 'true',
      clearLocalStorageAfterLogout: 'true',
      animatedBackground: 'false',
    });

    service.storeFormData(formData);

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_APP_MODE, 'limited');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SETTINGS_LOCK, 'true');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, 'true');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_ANIMATED_BACKGROUND, 'false');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_LANGUAGE, 'en');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_THEME, 'dark');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_FETCH_BATCH_SIZE, '25');
  });
});
