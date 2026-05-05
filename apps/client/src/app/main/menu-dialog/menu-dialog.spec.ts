import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { initialMainState, MainState, mainStateToken } from '../main-store';
import * as MainUtil from '../main-util';
import { ApiService } from '@services/api/api-service';
import { CollectionService } from '../../collection/collection-service';
import { LogoutService } from '../logout-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuDialog } from './menu-dialog';

describe('MenuDialog', () => {
  let fixture: ComponentFixture<MenuDialog>;
  let component: MenuDialog;
  let portal: { close: ReturnType<typeof vi.fn> };
  let collection: { triggerReload: ReturnType<typeof vi.fn> };
  let api: { logout: ReturnType<typeof vi.fn> };
  let logout: { performLogout: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    portal = { close: vi.fn() };
    collection = { triggerReload: vi.fn() };
    api = { logout: vi.fn(() => of(void 0)) };
    logout = { performLogout: vi.fn() };

    TestBed.configureTestingModule({
      imports: [MenuDialog],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: CollectionService, useValue: collection },
        { provide: ApiService, useValue: api },
        { provide: LogoutService, useValue: logout },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideSignalTranslateConfig({ path: '' }),
        provideStore(initialMainState, mainStateToken),
        { provide: Router, useValue: { url: '/' } },
      ],
    });

    TestBed.overrideComponent(MenuDialog, { set: { template: '' } });

    fixture = TestBed.createComponent(MenuDialog);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken);
    fixture.detectChanges();

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    redirectSpy.mockRestore();
  });

  it('closes dialog on close', () => {
    component['onClose']();
    expect(portal.close).toHaveBeenCalledTimes(1);
  });

  it('triggers collection reload and closes on sync', () => {
    component['onSync']();

    expect(collection.triggerReload).toHaveBeenCalled();
    expect(portal.close).toHaveBeenCalledTimes(1);
  });

  it('logs out successfully', () => {
    component['onLogout']();

    expect(api.logout).toHaveBeenCalled();
    expect(logout.performLogout).toHaveBeenCalled();
  });

  it('handles logout errors and still redirects', () => {
    api.logout.mockReturnValue(throwError(() => new Error('fail')));

    component['onLogout']();

    expect(api.logout).toHaveBeenCalled();
    expect(logout.performLogout).toHaveBeenCalled();
  });

  it('hides settings links when settings lock is enabled', () => {
    expect(component['settingLockEnabled']()).toBe(false);

    mainState.setState('settingsLock', true);
    fixture.detectChanges();

    expect(component['settingLockEnabled']()).toBe(true);
  });
});
