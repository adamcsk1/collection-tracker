import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SignUp } from './sign-up';

vi.mock('@shared/utils/copy-to-clipboard-util', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@shared/utils/mobile-user-agent.util', () => ({ mobileUserAgent: vi.fn() }));

describe('SignUp component', () => {
  let fixture: ComponentFixture<SignUp>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let publicApiService: { signUp: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let translateService: { languageOptions: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };

  beforeEach(() => {
    publicApiService = { signUp: vi.fn(() => of({ token: 'new-token' })) };
    webStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    translateService = { languageOptions: vi.fn(() => [{ text: 'English', value: 'en' }]) };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SignUp],
      providers: [
        { provide: PublicApiService, useValue: publicApiService },
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
    vi.spyOn(apiState, 'setState');
    vi.spyOn(toastState, 'setState');
    apiState.setState('apiUrl', 'https://stored-api');
    fixture.detectChanges();
  });

  it('preloads API URL and updates it when sending the form', async () => {
    const component = fixture.componentInstance;
    apiState.setState('apiUrl', 'https://old-api');

    expect(component['signUpModel']().apiUrl).toBe('https://stored-api');

    component['signUpModel'].set({ username: 'neo', apiUrl: 'https://new-api' });
    await component['onSend']();

    expect(publicApiService.signUp).toHaveBeenCalledWith('neo');
    expect(apiState.setState).toHaveBeenCalledWith('apiUrl', 'https://new-api');
    expect(webStorage.setItem).toHaveBeenCalledWith(STORAGE_API_URL, 'https://new-api');
    expect(component['secret']()).toBe('new-token');
  });

  it('copies the generated token and surfaces a toast on desktop browsers', () => {
    const component = fixture.componentInstance;
    const copySpy = copyToClipboard as Mock;
    const mobileSpy = mobileUserAgent as Mock;
    mobileSpy.mockReturnValue(false);
    component['secret'].set('copied-token');

    component['onCopyToClipboard']();

    expect(copySpy).toHaveBeenCalledWith('copied-token');
    expect(toastState.state.message()).toBe('Toast.CopiedToClipboard');
  });

  it('avoids toast when running on mobile user agents', () => {
    const component = fixture.componentInstance;
    const copySpy = copyToClipboard as Mock;
    const mobileSpy = mobileUserAgent as Mock;
    mobileSpy.mockReturnValue(true);
    component['secret'].set('secret-token');
    toastState.setState('message', '');

    component['onCopyToClipboard']();

    expect(copySpy).toHaveBeenCalledWith('secret-token');
    expect(toastState.state.message()).toBe('');
  });
});
