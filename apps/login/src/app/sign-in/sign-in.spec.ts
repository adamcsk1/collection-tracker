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
import { SignIn } from './sign-in';

describe('SignIn component', () => {
  let fixture: ComponentFixture<SignIn>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let themeState: NgxSimpleSignalStoreService<ThemeState>;
  let apiService: { signIn: jest.Mock };
  let webStorage: { getItem: jest.Mock; setItem: jest.Mock };
  let translateService: { languageOptions: jest.Mock };
  let ngxTranslate: { translate: jest.Mock; setLanguage: jest.Mock };
  let themeService: { themeOptions: jest.Mock };

  beforeEach(() => {
    apiService = { signIn: jest.fn(() => EMPTY) };
    webStorage = {
      getItem: jest.fn((key: string) => {
        if (key === STORAGE_LANGUAGE) return 'es';
        if (key === STORAGE_THEME) return 'dark';
        return null;
      }),
      setItem: jest.fn(),
    };
    translateService = { languageOptions: jest.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: jest.fn((value: string) => value), setLanguage: jest.fn() };
    themeService = { themeOptions: jest.fn(() => [{ text: 'Light', value: 'light' }]) };

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
    jest.spyOn(apiState, 'setState');
    jest.spyOn(themeState, 'setState');
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
    const toggle = fixture.nativeElement.querySelector('.small-text-button') as HTMLAnchorElement;
    expect(fixture.componentInstance['tokenInputType']()).toBe('password');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['tokenInputType']()).toBe('text');

    toggle.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    expect(fixture.componentInstance['tokenInputType']()).toBe('password');
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
