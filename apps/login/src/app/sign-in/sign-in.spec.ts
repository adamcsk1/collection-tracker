import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, ThemeState, themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LANGUAGE, STORAGE_THEME } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SignIn } from './sign-in';

describe('SignIn component', () => {
  let fixture: ComponentFixture<SignIn>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let apiService: { signIn: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let translateService: { languageOptions: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };
  let themeService: { themeOptions: Mock };

  beforeEach(() => {
    apiService = { signIn: vi.fn(() => EMPTY) };
    webStorage = {
      getItem: vi.fn((key: string) => {
        if (key === STORAGE_LANGUAGE) return 'es';
        if (key === STORAGE_THEME) return 'dark';
        return null;
      }),
      setItem: vi.fn(),
    };
    translateService = { languageOptions: vi.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };
    themeService = { themeOptions: vi.fn(() => [{ text: 'Light', value: 'light' }]) };

    TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: WebstorageService, useValue: webStorage },
        { provide: TranslateService, useValue: translateService },
        { provide: ThemeService, useValue: themeService },
        { provide: NgxSignalTranslateService, useValue: ngxTranslate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialThemeState, themeStateToken),
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(SignIn);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    themeState = TestBed.inject(themeStateToken) as NgxSimpleSignalStoreService<ThemeState>;
    vi.spyOn(apiState, 'setState');
    vi.spyOn(themeState, 'setState');
    apiState.setState('apiUrl', 'https://stored-api');
    fixture.detectChanges();
  });

  it('initializes with stored defaults and persists language/theme updates', () => {
    const component = fixture.componentInstance;

    expect(component['formGroup'].value).toEqual({
      username: '',
      token: '',
      apiUrl: 'https://stored-api',
      language: 'es',
      theme: 'dark',
    });

    component['formGroup'].controls.language.setValue('fr');
    component['formGroup'].controls.theme.setValue('system');

    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_LANGUAGE, 'fr');
    expect(ngxTranslate.setLanguage).toHaveBeenCalledWith('fr');
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_THEME, 'system');
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

  it('updates API URL, stores it, and signs in before redirecting', () => {
    const component = fixture.componentInstance;
    apiState.setState('apiUrl', 'https://old-api');

    component['formGroup'].setValue({
      username: 'neo',
      token: 'matrix',
      apiUrl: 'https://new-api',
      language: 'en',
      theme: 'light',
    });

    component['onSend']();

    expect(apiState.setState).toHaveBeenCalledWith('apiUrl', 'https://new-api');
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, 'https://new-api');
    expect(apiService.signIn).toHaveBeenCalledWith('neo', 'matrix');
  });
});
