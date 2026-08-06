import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainService } from './main-service';
import { initialMainState, mainStateToken } from './main-store';
import { TokenValidationService } from './token-validation-service';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidBackHandlerService } from './android-back-handler-service';
import { Main } from './main';

describe('Main component (client)', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let spinnerState: NgxSimpleSignalStoreService<{ show: boolean }>;
  let mainService: {
    tokenValid: ReturnType<typeof vi.fn>;
    loadStoredData: ReturnType<typeof vi.fn>;
  };
  let theme: { listen: ReturnType<typeof vi.fn> };
  let translate: { setLanguage: ReturnType<typeof vi.fn> };
  let portal: { setViewContainerRef: ReturnType<typeof vi.fn> };
  let tokenValidation: { startValidation: ReturnType<typeof vi.fn> };
  let androidBackHandler: { listen: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mainService = {
      tokenValid: vi.fn(() => null),
      loadStoredData: vi.fn(),
    };
    theme = { listen: vi.fn() };
    translate = { setLanguage: vi.fn() };
    portal = { setViewContainerRef: vi.fn() };
    tokenValidation = { startValidation: vi.fn() };
    androidBackHandler = { listen: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: MainService, useValue: mainService },
        { provide: TokenValidationService, useValue: tokenValidation },
        { provide: AndroidBackHandlerService, useValue: androidBackHandler },
        { provide: PortalService, useValue: portal },
        { provide: ThemeService, useValue: theme },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    TestBed.overrideComponent(Main, {
      set: {
        template: '',
      },
    });

    fixture = TestBed.createComponent(Main);
    apiState = TestBed.inject(apiStateToken);
    spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<{ show: boolean }>;
    fixture.detectChanges();
  });

  it('toggles the spinner based on API load status', () => {
    apiState.setState('loadNetworkStatus', 'pending');
    spinnerState.setState('show', true);
    expect(spinnerState.state.show()).toBe(true);

    apiState.setState('loadNetworkStatus', 'finished');
    spinnerState.setState('show', false);
    expect(spinnerState.state.show()).toBe(false);

    apiState.setState('loadNetworkStatus', 'error');
    spinnerState.setState('show', false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('starts token validation on init', () => {
    expect(tokenValidation.startValidation).toHaveBeenCalled();
  });

  it('sets the language and theme on init', () => {
    expect(theme.listen).toHaveBeenCalled();
    expect(translate.setLanguage).toHaveBeenCalledWith(initialMainState.language);
  });

  it('starts the Android back handler on init', () => {
    expect(androidBackHandler.listen).toHaveBeenCalledOnce();
  });
});
