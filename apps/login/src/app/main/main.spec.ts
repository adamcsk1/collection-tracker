import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

describe('Main component', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let blockerState: NgxSimpleSignalStoreService<BlockerLoadingState>;
  let apiService: { validateSession: Mock };
  let webStorage: { getItem: Mock; setItem: Mock; removeItem: Mock };
  let themeService: { listen: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };
  const initializeFixture = (): void => {
    fixture = TestBed.createComponent(Main);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<ThemeState>;
    blockerState = TestBed.inject(blockerLoadingStateToken) as NgxSimpleSignalStoreService<BlockerLoadingState>;
  };

  beforeEach(() => {
    apiService = { validateSession: vi.fn(() => EMPTY) };
    webStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    themeService = { listen: vi.fn() };
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
        provideRouter([]),
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

  it('hides the blocker loader and clears flag when validation fails', () => {
    webStorage.getItem.mockReturnValue('true');
    apiService.validateSession.mockReturnValue(throwError(() => new Error('invalid')));

    fixture.componentInstance.ngAfterViewInit();

    expect(blockerState.state.show()).toBe(false);
    expect(webStorage.removeItem).toHaveBeenCalledWith(STORAGE_LOGGED_IN);
  });

  it('hides the blocker without clearing the session when validation is rate limited', () => {
    webStorage.getItem.mockReturnValue('true');
    apiService.validateSession.mockReturnValue(throwError(() => ({ status: 429 })));

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
