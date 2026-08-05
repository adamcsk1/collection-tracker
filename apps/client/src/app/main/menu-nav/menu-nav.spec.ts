import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import * as MainUtil from '@shared/utils/redirect-to-login-util';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../collection/collection-service';
import { SettingsService } from '../../settings/settings-service';
import { LogoutService } from '../logout-service';
import { initialMainState, mainStateToken } from '../main-store';
import { MenuNav } from './menu-nav';

describe('MenuNav', () => {
  let fixture: ComponentFixture<MenuNav>;
  let component: MenuNav;
  let portal: { closeAll: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let collection: { triggerReload: ReturnType<typeof vi.fn> };
  let settings: { preloadUserSettings: ReturnType<typeof vi.fn> };
  let api: { logout: ReturnType<typeof vi.fn> };
  let logout: { performLogout: ReturnType<typeof vi.fn> };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    portal = { closeAll: vi.fn(), open: vi.fn() };
    collection = { triggerReload: vi.fn() };
    settings = { preloadUserSettings: vi.fn(() => of(void 0)) };
    api = { logout: vi.fn(() => of(void 0)) };
    logout = { performLogout: vi.fn() };

    TestBed.configureTestingModule({
      imports: [MenuNav],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: CollectionService, useValue: collection },
        { provide: SettingsService, useValue: settings },
        { provide: ApiService, useValue: api },
        { provide: LogoutService, useValue: logout },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideSignalTranslateConfig({ path: '' }),
        provideStore(initialMainState, mainStateToken),
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(MenuNav);
    component = fixture.componentInstance;
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
    expect(portal.closeAll).toHaveBeenCalledTimes(1);
  });

  it('triggers collection reload and closes on sync', () => {
    component['onSync']();

    expect(settings.preloadUserSettings).toHaveBeenCalled();
    expect(collection.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalledTimes(1);
  });

  it('opens about in a dialog', async () => {
    const { AboutDialog } = await import('../../about/about-dialog');

    await component['onOpenAbout']();

    expect(portal.open).toHaveBeenCalledWith(AboutDialog);
  });

  it('prevents default link navigation when opening about', async () => {
    const event = { preventDefault: vi.fn() } as unknown as Event;

    await component['onOpenAbout'](event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('shows only navigation links for enabled collection features', () => {
    const mainState = TestBed.inject(mainStateToken);
    const hasLink = (testId: string) => fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`) !== null;

    mainState.setState('collectionFeaturePreferences', {
      books: true,
      watchlist: true,
      wishlist: false,
      tracking: true,
    });
    fixture.detectChanges();

    expect(hasLink('nav-watchlist')).toBe(true);
    expect(hasLink('nav-wishlist')).toBe(false);
    expect(hasLink('nav-tracking')).toBe(true);
    expect(hasLink('nav-books')).toBe(false);

    mainState.setState('collectionFeaturePreferences', {
      books: false,
      watchlist: false,
      wishlist: true,
      tracking: false,
    });
    fixture.detectChanges();

    expect(hasLink('nav-watchlist')).toBe(false);
    expect(hasLink('nav-wishlist')).toBe(true);
    expect(hasLink('nav-tracking')).toBe(false);
    expect(hasLink('nav-books')).toBe(false);
  });

  it('still syncs collection when refreshing settings fails', () => {
    settings.preloadUserSettings.mockReturnValue(throwError(() => new Error('fail')));

    component['onSync']();

    expect(collection.triggerReload).toHaveBeenCalled();
    expect(portal.closeAll).toHaveBeenCalledTimes(1);
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
});
