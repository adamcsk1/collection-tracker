import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { settingsLockedGuard } from './settings-locked-guard';

describe('settingsLockedGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideStore(initialMainState, mainStateToken)],
    });
  });

  const resolveGuard = () =>
    TestBed.runInInjectionContext(() =>
      firstValueFrom(
        settingsLockedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<boolean>
      )
    );

  it('allows navigation when settingsLock is false', async () => {
    TestBed.inject(mainStateToken).setState('settingsLock', false);
    await expect(resolveGuard()).resolves.toBe(true);
  });

  it('blocks navigation when settingsLock is true', async () => {
    TestBed.inject(mainStateToken).setState('settingsLock', true);
    await expect(resolveGuard()).resolves.toBe(false);
  });
});
