import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastState, initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { SignUp } from './sign-up';

jest.mock('@shared/utils/copy-to-clipboard-util', () => ({ copyToClipboard: jest.fn() }));
jest.mock('@shared/utils/mobile-user-agent.util', () => ({ mobileUserAgent: jest.fn() }));

describe('SignUp component', () => {
  let fixture: ComponentFixture<SignUp>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let apiService: { signUp: jest.Mock };
  let webStorage: { getItem: jest.Mock; setItem: jest.Mock };
  let translateService: { languageOptions: jest.Mock };
  let ngxTranslate: { translate: jest.Mock; setLanguage: jest.Mock };

  beforeEach(() => {
    apiService = { signUp: jest.fn(() => of({ token: 'new-token' })) };
    webStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    translateService = { languageOptions: jest.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: jest.fn((value: string) => value), setLanguage: jest.fn() };

    TestBed.configureTestingModule({
      imports: [SignUp],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: WebstorageService, useValue: webStorage },
        { provide: TranslateService, useValue: translateService },
        { provide: NgxSignalTranslateService, useValue: ngxTranslate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(SignUp);
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
    toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    jest.spyOn(apiState, 'setState');
    jest.spyOn(toastState, 'setState');
    apiState.setState('apiUrl', 'https://stored-api');
    fixture.detectChanges();
  });

  it('preloads API URL and updates it when sending the form', () => {
    const component = fixture.componentInstance;
    apiState.setState('apiUrl', 'https://old-api');

    expect(component['formGroup'].value.apiUrl).toBe('https://stored-api');

    component['formGroup'].setValue({ username: 'neo', apiUrl: 'https://new-api' });
    component['onSend']();

    expect(apiService.signUp).toHaveBeenCalledWith('neo');
    expect(apiState.setState).toHaveBeenCalledWith('apiUrl', 'https://new-api');
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, 'https://new-api');
    expect(component['secret']()).toBe('new-token');
  });

  it('copies the generated token and surfaces a toast on desktop browsers', () => {
    const component = fixture.componentInstance;
    const copySpy = copyToClipboard as jest.Mock;
    const mobileSpy = mobileUserAgent as jest.Mock;
    mobileSpy.mockReturnValue(false);
    component['secret'].set('copied-token');

    component['onCopyToClipboard']();

    expect(copySpy).toHaveBeenCalledWith('copied-token');
    expect(toastState.state.message()).toBe('Toast.CopiedToClipboard');
  });

  it('avoids toast when running on mobile user agents', () => {
    const component = fixture.componentInstance;
    const copySpy = copyToClipboard as jest.Mock;
    const mobileSpy = mobileUserAgent as jest.Mock;
    mobileSpy.mockReturnValue(true);
    component['secret'].set('secret-token');
    toastState.setState('message', '');

    component['onCopyToClipboard']();

    expect(copySpy).toHaveBeenCalledWith('secret-token');
    expect(toastState.state.message()).toBe('');
  });
});
