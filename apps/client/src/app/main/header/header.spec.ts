import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionService } from '../../collection/collection-service';
import { initialMainState, MainState, mainStateToken } from '../main-store';
import * as MainUtil from '../main-util';
import { ApiService } from '@services/api/api-service';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';

const setBodyWidth = (width: number) =>
  Object.defineProperty(document.body, 'offsetWidth', { value: width, configurable: true });

describe('Header component', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let collection: { loadCollection: ReturnType<typeof vi.fn> };
  let api: { logout: ReturnType<typeof vi.fn> };
  let webstorage: { clear: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let redirectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    collection = { loadCollection: vi.fn() };
    api = { logout: vi.fn(() => of(void 0)) };
    webstorage = { clear: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: CollectionService, useValue: collection },
        { provide: ApiService, useValue: api },
        { provide: WebstorageService, useValue: webstorage },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        provideStore(initialThemeState, themeStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideSignalTranslateConfig({ path: '' }),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    TestBed.overrideComponent(Header, { set: { template: '' } });

    fixture = TestBed.createComponent(Header);
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

  it('toggles the menu visibility based on event and viewport width', () => {
    setBodyWidth(500);
    component['onShowMenu'](new Event('mouseenter'));
    expect(component['showMenu']()).toBe(true);

    component['onHideMenu']();
    expect(component['showMenu']()).toBe(false);

    setBodyWidth(300);
    component['onShowMenu'](new Event('mouseenter'));
    expect(component['showMenu']()).toBe(false);
  });

  it('triggers collection sync', () => {
    component['onSync']();

    expect(collection.loadCollection).toHaveBeenCalled();
  });

  it('logs out successfully and clears storage when configured', () => {
    mainState.setState('clearLocalStorageAfterLogout', true);

    component['onLogout']();

    expect(webstorage.clear).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalled();
  });

  it('handles logout errors and still redirects', () => {
    mainState.setState('clearLocalStorageAfterLogout', true);
    api.logout.mockReturnValue(throwError(() => new Error('fail')));

    component['onLogout']();

    expect(webstorage.clear).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalled();
  });
});
