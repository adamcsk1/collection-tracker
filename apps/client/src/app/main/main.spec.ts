import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { MainService } from '@client/main/main-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import * as MainModule from './main';
import { Main } from './main';

describe('Main component (client)', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<typeof initialApiState>;
  let mainService: {
    tokenValid: jest.Mock;
    loadStoredData: jest.Mock;
  };
  let collectionService: { loadCollection: jest.Mock };
  let router: { navigate: jest.Mock };
  let theme: { listen: jest.Mock };
  let translate: { setLanguage: jest.Mock };
  let portal: { setViewContainerRef: jest.Mock };
  let omdbState: NgxSimpleSignalStoreService<typeof initialOMDbState>;

  beforeEach(() => {
    mainService = {
      tokenValid: jest.fn(() => null),
      loadStoredData: jest.fn(),
    };
    collectionService = { loadCollection: jest.fn() };
    router = { navigate: jest.fn() };
    theme = { listen: jest.fn() };
    translate = { setLanguage: jest.fn() };
    portal = { setViewContainerRef: jest.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: MainService, useValue: mainService },
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: ThemeService, useValue: theme },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialOMDbState, omdbStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainState, mainStateToken),
        provideRouter([]),
        { provide: Router, useValue: router },
      ],
    });

    TestBed.overrideComponent(Main, {
      set: {
        imports: [],
        template: '',
      },
    });
  });

  it('toggles the spinner based on API load status', () => {
    fixture = TestBed.createComponent(Main);
    fixture.detectChanges();
    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<typeof initialApiState>;
    const spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<{ show: boolean }>;

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

  it('navigates to settings and loads the collection when the token is valid without OMDb key', () => {
    mainService.tokenValid.mockReturnValue(true);

    fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['settings']);
    expect(collectionService.loadCollection).toHaveBeenCalled();
    expect(theme.listen).toHaveBeenCalled();
    expect(translate.setLanguage).toHaveBeenCalledWith(initialMainState.language);
  });

  it('loads collection without navigating when token is valid and OMDb key exists', () => {
    mainService.tokenValid.mockReturnValue(true);
    omdbState = TestBed.inject(omdbStateToken) as NgxSimpleSignalStoreService<typeof initialOMDbState>;
    omdbState.setState('apiKey', 'abc123');

    fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).toHaveBeenCalled();
  });

  it('redirects to login when token validation fails', () => {
    const redirectSpy = jest.spyOn(MainModule, 'redirectToLogin').mockImplementation(() => {});
    mainService.tokenValid.mockReturnValue(false);

    fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(redirectSpy).toHaveBeenCalled();
    redirectSpy.mockRestore();
  });
});
