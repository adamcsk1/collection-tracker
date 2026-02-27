import { TestBed } from '@angular/core/testing';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import * as MainUtil from '@client/main/main-util';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutService } from './logout-service';

describe('LogoutService', () => {
  let service: LogoutService;
  let webstorage: { clear: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    webstorage = { clear: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        LogoutService,
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
      ],
    });

    service = TestBed.inject(LogoutService);
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;
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

  it('does not clear local storage when clearLocalStorageAfterLogout is disabled', () => {
    mainState.setState('clearLocalStorageAfterLogout', false);

    service.performLogout();

    expect(webstorage.clear).not.toHaveBeenCalled();
  });
});
