import { TestBed } from '@angular/core/testing';
import { initialMainState, MainState, mainStateToken } from './main-store';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_CLEAR_LOCAL_STORAGE_AFTER_LOGOUT,
  STORAGE_SENSITIVE_DATA_STORAGE,
} from '@shared/constants/storage-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainService } from './main-service';

describe('MainService', () => {
  let service: MainService;
  let api: { validateSession: ReturnType<typeof vi.fn> };
  let webstorage: { getItem: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;

  beforeEach(() => {
    api = { validateSession: vi.fn(() => of(undefined)) };
    webstorage = { getItem: vi.fn() };

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

  it('validates access token and marks it as valid', () => {
    service.validateSession();
    expect(service.tokenValid()).toBe(true);
    expect(api.validateSession).toHaveBeenCalled();
  });

  it('marks token as invalid when validation fails and rethrows the error', () => {
    api.validateSession.mockReturnValue(throwError(() => new Error('fail')));

    expect(() => service.validateSession()).not.toThrow();
    expect(service.tokenValid()).toBe(false);
  });
});
