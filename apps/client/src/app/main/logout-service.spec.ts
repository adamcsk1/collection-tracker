import { TestBed } from '@angular/core/testing';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_COLLECTION_FEATURE_PREFERENCES, STORAGE_LOGGED_IN } from '@shared/constants/storage-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as MainUtil from '@shared/utils/redirect-to-login-util';
import { LogoutService } from './logout-service';
import { initialMainState, MainState, mainStateToken } from './main-store';

describe('LogoutService', () => {
  let service: LogoutService;
  let webstorage: { clear: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    webstorage = { clear: vi.fn(), removeItem: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        LogoutService,
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
      ],
    });

    service = TestBed.inject(LogoutService);
    mainState = TestBed.inject(mainStateToken);
    redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});
  });

  afterEach(() => {
    redirectSpy.mockRestore();
  });

  it('always redirects to login', () => {
    service.performLogout();

    expect(redirectSpy).toHaveBeenCalled();
  });

  it('clears local storage when clearLocalStorageAfterLogout is enabled', () => {
    mainState.setState('clearLocalStorageAfterLogout', true);

    service.performLogout();

    expect(webstorage.clear).toHaveBeenCalled();
  });

  it('removes logged-in flag but does not clear all local storage when clearLocalStorageAfterLogout is disabled', () => {
    mainState.setState('clearLocalStorageAfterLogout', false);

    service.performLogout();

    expect(webstorage.clear).not.toHaveBeenCalled();
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_LOGGED_IN);
    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES);
  });
});
