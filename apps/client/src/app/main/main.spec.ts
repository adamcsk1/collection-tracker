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
import { ParserService } from '@services/parser/parser-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Main } from './main';
import * as MainUtil from './main-util';

describe('Main component (client)', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<typeof initialApiState>;
  let mainService: {
    tokenValid: ReturnType<typeof vi.fn>;
    loadStoredData: ReturnType<typeof vi.fn>;
  };
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let theme: { listen: ReturnType<typeof vi.fn> };
  let translate: { setLanguage: ReturnType<typeof vi.fn> };
  let portal: { setViewContainerRef: ReturnType<typeof vi.fn> };
  let omdbState: NgxSimpleSignalStoreService<typeof initialOMDbState>;

  beforeEach(() => {
    mainService = {
      tokenValid: vi.fn(() => null),
      loadStoredData: vi.fn(),
    };
    collectionService = { loadCollection: vi.fn() };
    router = { navigate: vi.fn() };
    theme = { listen: vi.fn() };
    translate = { setLanguage: vi.fn() };
    portal = { setViewContainerRef: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: MainService, useValue: mainService },
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: ThemeService, useValue: theme },
        { provide: ParserService, useValue: { preloadUserParserConfig: vi.fn(() => of(void 0)) } },
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
    const redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});
    mainService.tokenValid.mockReturnValue(false);

    fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(redirectSpy).toHaveBeenCalled();
    redirectSpy.mockRestore();
  });
});
