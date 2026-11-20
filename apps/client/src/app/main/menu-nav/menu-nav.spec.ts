import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActionMenu } from '@components/action-menu/action-menu';
import { provideRouter, Router } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import * as MainUtil from '@shared/utils/redirect-to-login-util';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutService } from '../logout-service';
import { initialMainState, mainStateToken } from '../main-store';
import { MenuNav } from './menu-nav';
import { ProfileStore } from '@services/profile/profile-store';

describe('MenuNav', () => {
  let fixture: ComponentFixture<MenuNav>;
  let component: MenuNav;
  let portal: { closeAll: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let api: { logout: ReturnType<typeof vi.fn> };
  let logout: { performLogout: ReturnType<typeof vi.fn> };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    portal = { closeAll: vi.fn(), open: vi.fn() };
    api = { logout: vi.fn(() => of(void 0)) };
    logout = { performLogout: vi.fn() };

    TestBed.configureTestingModule({
      imports: [MenuNav],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        { provide: LogoutService, useValue: logout },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideSignalTranslateConfig({ path: '' }),
        provideStore(initialMainState, mainStateToken),
        provideRouter([
          { path: 'collection/:list', children: [] },
          { path: 'settings', children: [] },
          { path: 'about', children: [] },
        ]),
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

  it('uses the logged-in display name and avatar as the account trigger, retaining the username', async () => {
    TestBed.inject(ProfileStore).setProfile({
      userShareCode: 'viewer',
      username: 'username',
      displayName: 'Display name',
      avatarRevision: null,
    });
    await fixture.whenStable();
    const link: HTMLButtonElement = fixture.nativeElement.querySelector('[data-test-id="nav-profile"]');
    expect(link.tagName).toBe('BUTTON');
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-haspopup')).toBe('dialog');
    expect(link.textContent).toContain('Display name');
    expect(link.textContent).toContain('username');
    expect(link.querySelector('libc-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.querySelector('[data-test-id="avatar-fallback"]')?.getAttribute('aria-label')).toBe('Display name');
    TestBed.inject(ProfileStore).setProfile({
      userShareCode: 'viewer',
      username: null,
      displayName: null,
      avatarRevision: null,
    });
    await fixture.whenStable();
    expect(link.textContent).toContain('viewer');
  });

  it('keeps translated account actions available when profile loading fails', () => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('[data-test-id="nav-profile"]');
    expect(trigger.textContent).toContain('Account');
    expect(trigger.querySelector('libc-avatar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nav [data-test-id="nav-profile"]')).toBeNull();
    const menu = fixture.debugElement.query(By.directive(ActionMenu)).componentInstance as ActionMenu;
    expect(menu.actions()).toEqual([
      { id: 'nav-settings', label: 'Settings', icon: 'settings' },
      { id: 'nav-about', label: 'About', icon: 'info' },
      { id: 'nav-logout', label: 'Logout', icon: 'logout', destructive: true },
    ]);
    expect(
      fixture.nativeElement.querySelectorAll(
        'a[data-test-id="nav-settings"], a[data-test-id="nav-about"], a[data-test-id="nav-logout"]'
      )
    ).toHaveLength(0);
  });

  it.each(['settings', 'about'])(
    'navigates to %s and closes the navigation on account selection',
    async (destination) => {
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate');
      const menu = fixture.debugElement.query(By.directive(ActionMenu)).componentInstance as ActionMenu;
      menu.selected.emit(`nav-${destination}`);
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/', destination]);
      expect(router.url).toBe(`/${destination}`);
      expect(portal.closeAll).toHaveBeenCalledOnce();
    }
  );

  it('logs out through the account action without navigating', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const menu = fixture.debugElement.query(By.directive(ActionMenu)).componentInstance as ActionMenu;
    menu.selected.emit('nav-logout');
    expect(api.logout).toHaveBeenCalledOnce();
    expect(logout.performLogout).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides decorative navigation icons from assistive technology', () => {
    const brand = fixture.nativeElement.querySelector('[data-test-id="navigation-brand"]') as HTMLElement;
    expect(brand.getAttribute('role')).toBe('region');
    expect(brand.getAttribute('aria-label')).toBe('AppTitle');
    const icons = fixture.nativeElement.querySelectorAll('nav .material-icons') as NodeListOf<HTMLElement>;
    expect(icons.length).toBeGreaterThan(0);
    expect(Array.from(icons).every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it.each(['library', 'books', 'music'])(
    'marks the collection link current for %s and clears it on leaving',
    async (list) => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(`/collection/${list}`);
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const collection = element.querySelector('[data-test-id="nav-collection"]')!;
      expect(collection.classList.contains('active')).toBe(true);
      expect(collection.getAttribute('aria-current')).toBe('page');
      expect(element.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);

      await router.navigateByUrl('/settings');
      await fixture.whenStable();
      expect(collection.classList.contains('active')).toBe(false);
      expect(collection.hasAttribute('aria-current')).toBe(false);
      expect(element.querySelectorAll('a[aria-current="page"]')).toHaveLength(0);
    }
  );

  it('shows only navigation links for enabled collection features', () => {
    const mainState = TestBed.inject(mainStateToken);
    const hasLink = (testId: string) => fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`) !== null;

    mainState.setState('collectionFeaturePreferences', {
      books: true,
      music: true,
      upNext: true,
      wishlist: false,
      tracking: true,
    });
    fixture.detectChanges();

    expect(hasLink('nav-up-next')).toBe(true);
    expect(hasLink('nav-wishlist')).toBe(false);
    expect(hasLink('nav-tracking')).toBe(true);
    expect(hasLink('nav-books')).toBe(false);

    mainState.setState('collectionFeaturePreferences', {
      books: false,
      music: false,
      upNext: false,
      wishlist: true,
      tracking: false,
    });
    fixture.detectChanges();

    expect(hasLink('nav-up-next')).toBe(false);
    expect(hasLink('nav-wishlist')).toBe(true);
    expect(hasLink('nav-tracking')).toBe(false);
    expect(hasLink('nav-books')).toBe(false);
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
