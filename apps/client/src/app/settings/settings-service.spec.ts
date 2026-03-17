import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { SettingsModel } from '@client/settings/settings-model';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_APP_MODE,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_SENSITIVE_DATA_STORAGE,
  STORAGE_SETTINGS_LOCK,
} from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings-service';

const buildFormData = (overrides: Partial<SettingsModel> = {}): SettingsModel => ({
  appMode: 'full',
  settingsLock: false,
  sensitiveDataStorage: 'local',
  clearLocalStorageAfterLogout: false,
  animatedBackground: true,
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
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let api: {
    getUserSettings: ReturnType<typeof vi.fn>;
    updateUserSettings: ReturnType<typeof vi.fn>;
  };
  let translate: { translate: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn> };
  let main: { setPermissions: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;
  let apiState: NgxSimpleSignalStoreService<typeof initialApiState>;

  beforeEach(() => {
    router = { navigate: vi.fn() };
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    api = { getUserSettings: vi.fn(() => of({})), updateUserSettings: vi.fn(() => of(void 0)) };
    translate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };
    main = { setPermissions: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: Router, useValue: router },
        { provide: ApiService, useValue: api },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: translate },
        { provide: MainService, useValue: main },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(SettingsService);
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<typeof initialApiState>;
  });

  it('stores form data, syncs settings to the API', () => {
    const formData = buildFormData({ searchMode: 'fuzzy', sensitiveDataStorage: 'session' });

    service.storeFormData(formData);

    expect(mainState.state.searchMode()).toBe('fuzzy');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SENSITIVE_DATA_STORAGE, 'session');
    expect(api.updateUserSettings).toHaveBeenCalledWith({
      searchMode: 'fuzzy',
      fetchBatchSize: 25,
      theme: 'dark',
      animatedBackground: true,
      language: 'en',
    });
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
      settingsLock: true,
      clearLocalStorageAfterLogout: true,
      animatedBackground: false,
    });

    service.storeFormData(formData);

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_APP_MODE, 'limited');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_SETTINGS_LOCK, 'true');
    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT, 'true');
    expect(api.updateUserSettings).toHaveBeenCalledWith({
      searchMode: 'standard',
      fetchBatchSize: 25,
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });
  });

  it('preloads migrated settings from the API and leaves defaults for missing values', () => {
    api.getUserSettings.mockReturnValue(
      of({
        searchMode: 'fuzzy',
        fetchBatchSize: 50,
        theme: 'dark',
      })
    );

    service.preloadUserSettings().subscribe();

    expect(mainState.state.searchMode()).toBe('fuzzy');
    expect(apiState.state.fetchBatchSize()).toBe(50);
    expect(translate.setLanguage).not.toHaveBeenCalled();
    expect(mainState.state.language()).toBe('en');
    expect(mainState.state.animatedBackground()).toBe(true);
  });
});
