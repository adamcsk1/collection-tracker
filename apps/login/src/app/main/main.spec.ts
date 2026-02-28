import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BlockerLoadingState,
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { ThemeState, initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { API_PREFIX } from '@shared/constants/api-const';
import { STORAGE_API_URL, STORAGE_LANGUAGE, STORAGE_THEME } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Main } from './main';

describe('Main component', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let blockerState: NgxSimpleSignalStoreService<BlockerLoadingState>;
  let apiService: { validateAccessToken: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let themeService: { listen: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };
  const createFixture = (): void => {
    fixture = TestBed.createComponent(Main);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<ThemeState>;
    blockerState = TestBed.inject(blockerLoadingStateToken) as NgxSimpleSignalStoreService<BlockerLoadingState>;
    vi.spyOn(apiState, 'setState');
    vi.spyOn(blockerState, 'setState');
  };

  beforeEach(() => {
    apiService = { validateAccessToken: vi.fn(() => EMPTY) };
    webStorage = {
      getItem: vi.fn((key: string) => {
        if (key === STORAGE_LANGUAGE) return 'fr';
        if (key === STORAGE_THEME) return 'dark';
        return null;
      }),
      setItem: vi.fn(),
    };
    themeService = { listen: vi.fn() };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ApiService, useValue: apiService },
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
  });

  it('bootstraps language, theme, blocker state, and API URL defaults', () => {
    createFixture();
    const expectedApiUrl = `${window.location.origin}${API_PREFIX}`;

    expect(ngxTranslate.setLanguage).toHaveBeenCalledWith('fr');
    expect(blockerState.state.show()).toBe(true);
    expect(blockerState.state.withoutDelay()).toBe(true);
    expect(themeState.state.theme()).toBe('dark');
    expect(themeService.listen).toHaveBeenCalled();
    expect(apiState.state.apiUrl()).toBe(expectedApiUrl);
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, expectedApiUrl);
  });

  it('falls back to light theme when stored theme is invalid', () => {
    webStorage.getItem.mockImplementation((key: string) => {
      if (key === STORAGE_LANGUAGE) return 'fr';
      if (key === STORAGE_THEME) return 'invalid';
      return null;
    });
    createFixture();

    expect(themeState.state.theme()).toBe('light');
  });

  it('calls validateAccessToken on after view init', () => {
    createFixture();
    fixture.componentInstance.ngAfterViewInit();

    expect(apiService.validateAccessToken).toHaveBeenCalled();
  });

  it('hides the blocker loader when validation fails', () => {
    createFixture();
    apiService.validateAccessToken.mockReturnValue(throwError(() => new Error('invalid')));

    fixture.componentInstance.ngAfterViewInit();

    expect(blockerState.state.show()).toBe(false);
  });
});
