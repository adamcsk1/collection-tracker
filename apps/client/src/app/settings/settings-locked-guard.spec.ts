import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { settingsLockedGuard } from './settings-locked-guard';

describe('settingsLockedGuard', () => {
  it('always allows navigation', () => {
    TestBed.runInInjectionContext(() => {
      const result = settingsLockedGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);
      expect(result).toBe(true);
    });
  });
});
