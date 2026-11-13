import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
  type BlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState, type ApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken, type ThemeState } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LOGGED_IN } from '@shared/constants/storage-const';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { Main } from './main';

@Component({ selector: 'ct-test-page', template: '<h2 tabindex="-1">Page</h2>' })
class TestPage {}

describe('Main component', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let blockerState: NgxSimpleSignalStoreService<BlockerLoadingState>;
  let apiService: { validateSession: Mock; getBackgroundImages: Mock };
  let webStorage: { getItem: Mock; setItem: Mock; removeItem: Mock };
  let themeService: { listen: Mock; themeLogo: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };
  const initializeFixture = (): void => {
    fixture = TestBed.createComponent(Main);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<ThemeState>;
    blockerState = TestBed.inject(blockerLoadingStateToken) as NgxSimpleSignalStoreService<BlockerLoadingState>;
  };

  beforeEach(() => {
    apiService = { validateSession: vi.fn(() => EMPTY), getBackgroundImages: vi.fn(() => EMPTY) };
    webStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    themeService = { listen: vi.fn(), themeLogo: vi.fn(() => 'logo.png') };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: PublicApiService, useValue: apiService },
        { provide: WebstorageService, useValue: webStorage },
        { provide: ThemeService, useValue: themeService },
        { provide: NgxSignalTranslateService, useValue: ngxTranslate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideRouter([
          { path: 'sign-in', component: TestPage },
          { path: 'sign-up', component: TestPage },
        ]),
      ],
    });

    initializeFixture();
  });

  it('bootstraps language, theme, blocker state, and API URL defaults', () => {
    const expectedApiUrl = `${window.location.origin}${getApiPrefix()}`;

    expect(ngxTranslate.setLanguage).toHaveBeenCalledWith('en');
    expect(blockerState.state.show()).toBe(true);
    expect(blockerState.state.withoutDelay()).toBe(true);
    expect(themeState.state.theme()).toBe('light');
    expect(themeService.listen).toHaveBeenCalled();
    expect(apiState.state.apiUrl()).toBe(expectedApiUrl);
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, expectedApiUrl);
    expect(webStorage.getItem).toHaveBeenCalledWith(STORAGE_API_URL);
  });

  it('does not nest a banner landmark inside the main landmark', () => {
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('[role="main"]') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.querySelector('[role="banner"]')).toBeNull();
  });

  it('updates title and focuses the heading only when the route path changes', async () => {
    const router = TestBed.inject(Router);
    const title = TestBed.inject(Title);
    fixture.detectChanges();
    await router.navigateByUrl('/sign-in');
    await fixture.whenStable();
    expect(title.getTitle()).toBe('SignIn - AppTitle');
    expect(document.activeElement).not.toBe(fixture.nativeElement.querySelector('h2'));

    await router.navigateByUrl('/sign-up');
    await fixture.whenStable();
    expect(title.getTitle()).toBe('SignUp - AppTitle');
    const heading = fixture.nativeElement.querySelector('h2') as HTMLElement;
    expect(document.activeElement).toBe(heading);

    heading.blur();
    await router.navigateByUrl('/sign-up?source=login#form');
    await fixture.whenStable();
    expect(document.activeElement).not.toBe(heading);
  });

  it('uses a stored API URL when available', () => {
    webStorage.getItem.mockReturnValue('https://stored-api');
    webStorage.setItem.mockClear();
    initializeFixture();

    expect(apiState.state.apiUrl()).toBe('https://stored-api');
    expect(webStorage.setItem).not.toHaveBeenCalled();
  });

  it('calls validateSession on after view init when logged in flag is set', () => {
    webStorage.getItem.mockReturnValue('true');
    fixture.componentInstance.ngAfterViewInit();

    expect(apiService.validateSession).toHaveBeenCalled();
  });

  it('skips validateSession and hides blocker when logged in flag is not set', () => {
    fixture.componentInstance.ngAfterViewInit();

    expect(apiService.validateSession).not.toHaveBeenCalled();
    expect(blockerState.state.show()).toBe(false);
  });

  it.each([401, 403])('hides the blocker and clears the session when credentials are rejected with %s', (status) => {
    webStorage.getItem.mockReturnValue('true');
    apiService.validateSession.mockReturnValue(throwError(() => ({ status })));

    fixture.componentInstance.ngAfterViewInit();

    expect(blockerState.state.show()).toBe(false);
    expect(webStorage.removeItem).toHaveBeenCalledWith(STORAGE_LOGGED_IN);
  });

  it.each([0, 429, 500, 502, 503, 504])('preserves the session on temporary validation failure %s', (status) => {
    webStorage.getItem.mockReturnValue('true');
    apiService.validateSession.mockReturnValue(throwError(() => ({ status })));

    fixture.componentInstance.ngAfterViewInit();

    expect(blockerState.state.show()).toBe(false);
    expect(webStorage.removeItem).not.toHaveBeenCalled();
  });

  it('redirects to client app with base path after successful validation', () => {
    webStorage.getItem.mockReturnValue('true');
    apiService.validateSession.mockReturnValue(of(void 0));
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    fixture.componentInstance.ngAfterViewInit();

    expect(window.location.href).toContain('/client/');

    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});
