import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MainService } from '@client/main/main-service';
import * as MainUtil from '@client/main/main-util';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, isObservable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mainGuard } from './main-guard';

describe('mainGuard', () => {
  let tokenValid = signal<boolean | null>(null);
  let main: {
    tokenValid: typeof tokenValid;
    hasRequiredConfig: ReturnType<typeof vi.fn>;
    validateAccessToken: ReturnType<typeof vi.fn>;
    loadStoredData: ReturnType<typeof vi.fn>;
  };
  let webstorage: { clear: ReturnType<typeof vi.fn> };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    tokenValid = signal<boolean | null>(null);
    main = {
      tokenValid,
      hasRequiredConfig: vi.fn(() => true),
      validateAccessToken: vi.fn(() => tokenValid.set(true)),
      loadStoredData: vi.fn(),
    };
    webstorage = { clear: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: MainService, useValue: main },
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
      ],
    });

    redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    redirectSpy.mockRestore();
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
    expect(redirectSpy).toHaveBeenCalled();
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
