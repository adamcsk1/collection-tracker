import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiStateToken, initialApiState, type ApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { ConfirmService } from '@services/confirm-service';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken, type ThemeState } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import {
  STORAGE_API_URL,
  STORAGE_COLLECTION_FEATURE_PREFERENCES,
  STORAGE_LOGGED_IN,
} from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SignIn } from './sign-in';

describe('SignIn component', () => {
  let fixture: ComponentFixture<SignIn>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let publicApiService: { signIn: Mock };
  let sharedApiService: { updateUserSettings: Mock };
  let webStorage: { getItem: Mock; setItem: Mock; removeItem: Mock };
  let confirm: { ifConfirmed: Mock };
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
      removeItem: vi.fn(),
    };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    translateService = { languageOptions: vi.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };
    themeService = { themeOptions: vi.fn(() => [{ text: 'Light', value: 'light' }]) };

    TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        { provide: PublicApiService, useValue: publicApiService },
        { provide: SharedApiService, useValue: sharedApiService },
        { provide: ConfirmService, useValue: confirm },
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

  it('requires a non-empty username', () => {
    const usernameField = fixture.componentInstance['form'].username();

    usernameField.value.set('');

    expect(usernameField.valid()).toBe(false);
  });

  it.each([1, 33])('submits a legacy username with length %s', async (length) => {
    const component = fixture.componentInstance;
    const username = 'u'.repeat(length);
    component['signInModel'].set({
      username,
      token: 'matrix',
      apiUrl: 'https://stored-api',
      language: 'en',
      theme: 'light',
    });
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('[data-test-id="sign-in-submit"]') as HTMLButtonElement;
    submitButton.click();

    await vi.waitFor(() => expect(publicApiService.signIn).toHaveBeenCalledWith(username, 'matrix'));
  });

  it('toggles token visibility through the UI control', () => {
    const component = fixture.componentInstance;
    const toggleButton = fixture.nativeElement.querySelector(
      '[data-test-id="sign-in-toggle-secret"]'
    ) as HTMLButtonElement;
    expect(component['tokenInputType']()).toBe('password');
    expect(toggleButton.tagName).toBe('BUTTON');
    expect(toggleButton.textContent?.trim()).toBe('ShowSecret');
    expect(toggleButton.hasAttribute('aria-label')).toBe(false);
    expect(toggleButton.hasAttribute('aria-pressed')).toBe(false);

    toggleButton.click();
    fixture.detectChanges();
    expect(component['tokenInputType']()).toBe('text');
    expect(toggleButton.textContent?.trim()).toBe('HideSecret');

    toggleButton.click();
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
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_LOGGED_IN, 'true');
    expect(webStorage.removeItem).toHaveBeenCalledWith(STORAGE_COLLECTION_FEATURE_PREFERENCES);
    expect(sharedApiService.updateUserSettings).toHaveBeenCalledWith({
      language: 'en',
      theme: 'light',
      fromLogin: true,
    });
  });

  it('keeps matching API URL without storing it again', async () => {
    const component = fixture.componentInstance;
    component['signInModel'].set({
      username: 'neo',
      token: 'matrix',
      apiUrl: 'https://stored-api',
      language: 'en',
      theme: 'light',
    });
    webStorage.setItem.mockClear();

    await component['onSend']();

    expect(webStorage.setItem).not.toHaveBeenCalledWith(STORAGE_API_URL, expect.any(String));
  });

  it('uses empty API URL when none is configured', () => {
    apiState.setState('apiUrl', '');

    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance['signInModel']().apiUrl).toBe('');
  });

  it('detects whether companion app is available', () => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    expect(fixture.componentInstance['companionAppDetected']).toBe(false);

    window.CollectionTrackerInterface = {};
    initializeFixture();
    expect(fixture.componentInstance['companionAppDetected']).toBe(true);
  });

  it('calls companion app reset function when confirmed', () => {
    const resetAppConfig = vi.fn(() => true);
    window.CollectionTrackerInterface = { resetAppConfig };
    initializeFixture();

    fixture.componentInstance['onResetCompanionAppConfig']();

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.CompanionAppReset');
    expect(resetAppConfig).toHaveBeenCalledTimes(1);
  });

  it('does not reset companion app config when not confirmed', () => {
    const resetAppConfig = vi.fn(() => true);
    confirm.ifConfirmed.mockReturnValue(of());
    window.CollectionTrackerInterface = { resetAppConfig };
    initializeFixture();

    fixture.componentInstance['onResetCompanionAppConfig']();

    expect(resetAppConfig).not.toHaveBeenCalled();
  });

  it('does nothing when companion app reset function is unavailable', () => {
    window.CollectionTrackerInterface = {};
    initializeFixture();

    expect(() => fixture.componentInstance['onResetCompanionAppConfig']()).not.toThrow();
  });
});
