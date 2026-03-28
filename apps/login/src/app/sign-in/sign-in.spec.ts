import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, ThemeState, themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SignIn } from './sign-in';

describe('SignIn component', () => {
  let fixture: ComponentFixture<SignIn>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let publicApiService: { signIn: Mock };
  let sharedApiService: { updateUserSettings: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let translateService: { languageOptions: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };
  let themeService: { themeOptions: Mock };
  const initializeFixture = (): void => {
    fixture = TestBed.createComponent(SignIn);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<ThemeState>;
    apiState.setState('apiUrl', 'https://stored-api');
    fixture.detectChanges();
  };

  beforeEach(() => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    publicApiService = { signIn: vi.fn(() => of(undefined)) };
    sharedApiService = { updateUserSettings: vi.fn(() => of(undefined)) };
    webStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    translateService = { languageOptions: vi.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };
    themeService = { themeOptions: vi.fn(() => [{ text: 'Light', value: 'light' }]) };

    TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        { provide: PublicApiService, useValue: publicApiService },
        { provide: SharedApiService, useValue: sharedApiService },
        { provide: WebstorageService, useValue: webStorage },
        { provide: TranslateService, useValue: translateService },
        { provide: ThemeService, useValue: themeService },
        { provide: NgxSignalTranslateService, useValue: ngxTranslate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideRouter([]),
      ],
    });

    initializeFixture();
    vi.spyOn(apiState, 'setState');
    vi.spyOn(themeState, 'setState');
  });

  it('initializes with stored defaults and persists language/theme updates', () => {
    const component = fixture.componentInstance;

    expect(component['signInModel']()).toEqual({
      username: '',
      token: '',
      apiUrl: 'https://stored-api',
      language: 'en',
      theme: 'light',
    });

    expect(webStorage.getItem).not.toHaveBeenCalled();
    expect(ngxTranslate.setLanguage).toHaveBeenCalledWith('en');

    ngxTranslate.setLanguage.mockClear();
    component['form'].theme().value.set('system');
    fixture.detectChanges();

    expect(ngxTranslate.setLanguage).not.toHaveBeenCalled();
    expect(themeState.state.theme()).toBe('system');
  });

  it('toggles token visibility through the UI control', () => {
    const component = fixture.componentInstance;
    expect(component['tokenInputType']()).toBe('password');

    component['onToggleTokenInputType']();
    fixture.detectChanges();
    expect(component['tokenInputType']()).toBe('text');

    component['onToggleTokenInputType']();
    expect(component['tokenInputType']()).toBe('password');
  });

  it('updates API URL, stores it, signs in, and persists login settings', async () => {
    const component = fixture.componentInstance;
    apiState.setState('apiUrl', 'https://old-api');

    component['signInModel'].set({
      username: 'neo',
      token: 'matrix',
      apiUrl: 'https://new-api',
      language: 'en',
      theme: 'light',
    });

    await component['onSend']();

    expect(apiState.setState).toHaveBeenCalledWith('apiUrl', 'https://new-api');
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, 'https://new-api');
    expect(publicApiService.signIn).toHaveBeenCalledWith('neo', 'matrix');
    expect(sharedApiService.updateUserSettings).toHaveBeenCalledWith({
      language: 'en',
      theme: 'light',
    });
  });

  it('detects whether companion app is available', () => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    expect(fixture.componentInstance['companionAppDetected']).toBe(false);

    window.CollectionTrackerInterface = {};
    initializeFixture();
    expect(fixture.componentInstance['companionAppDetected']).toBe(true);
  });

  it('calls companion app reset function when configured', () => {
    const resetAppConfig = vi.fn(() => true);
    window.CollectionTrackerInterface = { resetAppConfig };
    initializeFixture();

    fixture.componentInstance['onResetCompanionAppConfig']();

    expect(resetAppConfig).toHaveBeenCalledTimes(1);
  });

  it('does nothing when companion app reset function is unavailable', () => {
    window.CollectionTrackerInterface = {};
    initializeFixture();

    expect(() => fixture.componentInstance['onResetCompanionAppConfig']()).not.toThrow();
  });
});
