import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MainService } from '@client/main/main-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, isObservable } from 'rxjs';
import { mainGuard } from './main-guard';

describe('mainGuard', () => {
  let tokenValid = signal<boolean | null>(null);
  let main: {
    tokenValid: typeof tokenValid;
    hasRequiredConfig: jest.Mock;
    validateAccessToken: jest.Mock;
    loadStoredData: jest.Mock;
  };
  let webstorage: { clear: jest.Mock };
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    tokenValid = signal<boolean | null>(null);
    main = {
      tokenValid,
      hasRequiredConfig: jest.fn(() => true),
      validateAccessToken: jest.fn(() => tokenValid.set(true)),
      loadStoredData: jest.fn(),
    };
    webstorage = { clear: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: MainService, useValue: main },
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
      ],
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const resolveGuard = async () => {
    const result = TestBed.runInInjectionContext(() =>
      mainGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result as boolean);
  };

  it('allows navigation immediately when the token is already valid', async () => {
    tokenValid.set(true);

    await expect(resolveGuard()).resolves.toBe(true);
    expect(main.validateAccessToken).not.toHaveBeenCalled();
  });

  it('validates access token when config is present and waits for result', async () => {
    tokenValid.set(null);
    main.hasRequiredConfig.mockReturnValue(true);

    await expect(resolveGuard()).resolves.toBe(true);
    expect(main.validateAccessToken).toHaveBeenCalled();
  });

  it('clears storage and redirects to login when config is missing', async () => {
    main.hasRequiredConfig.mockReturnValueOnce(false).mockReturnValueOnce(false);
    const mainState = TestBed.inject(mainStateToken);
    mainState.setState('clearLocalStorageAfterLogout', true);

    const allowed = await resolveGuard();
    expect(main.loadStoredData).toHaveBeenCalled();
    expect(webstorage.clear).toHaveBeenCalled();
    expect(allowed).toBe(false);
  });

  it('loads stored data and validates token when config becomes available after load', async () => {
    tokenValid.set(null);
    main.hasRequiredConfig.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const allowed = await resolveGuard();

    expect(main.loadStoredData).toHaveBeenCalled();
    expect(main.validateAccessToken).toHaveBeenCalled();
    expect(allowed).toBe(true);
  });
});
