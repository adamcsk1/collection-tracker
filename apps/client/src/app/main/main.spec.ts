import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { MainService } from './main-service';
import { initialMainState, mainStateToken } from './main-store';
import { TokenValidationService } from './token-validation-service';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState, type ApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidBackHandlerService } from '@services/android-back-handler-service';
import { Main } from './main';
import { FloatActionsService } from './float-actions/float-actions-service';

describe('Main component (client)', () => {
  let fixture: ComponentFixture<Main>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let spinnerState: NgxSimpleSignalStoreService<{ show: boolean }>;
  let mainService: {
    tokenValid: ReturnType<typeof vi.fn>;
    loadStoredData: ReturnType<typeof vi.fn>;
  };
  let theme: { listen: ReturnType<typeof vi.fn> };
  let translate: { setLanguage: ReturnType<typeof vi.fn>; translate: ReturnType<typeof vi.fn> };
  let portal: { setViewContainerRef: ReturnType<typeof vi.fn>; componentRef: ReturnType<typeof vi.fn> };
  let routerEvents: Subject<NavigationEnd>;
  let route: { data: Record<string, string>; firstChild: null };
  let title: { setTitle: ReturnType<typeof vi.fn> };
  let tokenValidation: { startValidation: ReturnType<typeof vi.fn> };
  let androidBackHandler: { listen: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mainService = {
      tokenValid: vi.fn(() => null),
      loadStoredData: vi.fn(),
    };
    theme = { listen: vi.fn() };
    translate = { setLanguage: vi.fn(), translate: vi.fn((key: string) => key) };
    portal = { setViewContainerRef: vi.fn(), componentRef: vi.fn(() => null) };
    routerEvents = new Subject<NavigationEnd>();
    route = { data: {}, firstChild: null };
    title = { setTitle: vi.fn() };
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
        { provide: Router, useValue: { events: routerEvents, routerState: { snapshot: { root: route } } } },
        { provide: Title, useValue: title },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    TestBed.overrideComponent(Main, {
      set: {
        template: '<div #mainContent tabindex="-1"></div>',
      },
    });

    fixture = TestBed.createComponent(Main);
    apiState = TestBed.inject(apiStateToken);
    spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<{ show: boolean }>;
    fixture.detectChanges();
  });

  it('toggles the spinner based on API load status', async () => {
    apiState.setState('loadNetworkStatus', 'pending');
    await fixture.whenStable();
    expect(spinnerState.state.show()).toBe(true);

    apiState.setState('loadNetworkStatus', 'finished');
    await fixture.whenStable();
    expect(spinnerState.state.show()).toBe(false);

    apiState.setState('loadNetworkStatus', 'pending');
    await fixture.whenStable();
    expect(spinnerState.state.show()).toBe(true);

    apiState.setState('loadNetworkStatus', 'error');
    await fixture.whenStable();
    expect(spinnerState.state.show()).toBe(false);
  });

  it('provides a translated page heading and a content skip target', async () => {
    route.data = { titleKey: 'Tracking' };
    routerEvents.next(new NavigationEnd(1, '/collection/tracking', '/collection/tracking'));
    await fixture.whenStable();
    expect(fixture.componentInstance['translations'].pageTitle()).toBe('Tracking');
    fixture.componentInstance['onSkipToContent']();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('div'));
  });

  it('starts token validation on init', () => {
    expect(tokenValidation.startValidation).toHaveBeenCalled();
  });

  it('keeps background visibility independent of animation', () => {
    const mainState = TestBed.inject(mainStateToken);
    expect(mainState.state.backgroundAnimation()).toBe(true);
    expect(fixture.componentInstance['useAnimatedBackground']()).toBe(true);

    mainState.setState('backgroundAnimation', false);

    expect(fixture.componentInstance['backgroundAnimation']()).toBe(false);
    expect(fixture.componentInstance['useAnimatedBackground']()).toBe(true);

    mainState.setState('animatedBackground', false);

    expect(fixture.componentInstance['useAnimatedBackground']()).toBe(false);
    expect(mainState.state.backgroundAnimation()).toBe(false);

    mainState.setState('animatedBackground', true);
    expect(fixture.componentInstance['useAnimatedBackground']()).toBe(true);
    expect(fixture.componentInstance['backgroundAnimation']()).toBe(false);
  });

  it('requests search expansion and focus from the skip link', () => {
    const focusSearch = vi.spyOn(TestBed.inject(FloatActionsService), 'focusSearch');
    fixture.componentInstance['onSkipToSearch']();
    expect(focusSearch).toHaveBeenCalledOnce();
  });

  it('sets the language and theme on init', () => {
    expect(theme.listen).toHaveBeenCalled();
    expect(translate.setLanguage).toHaveBeenCalledWith(initialMainState.language);
  });

  it('starts the Android back handler on init', () => {
    expect(androidBackHandler.listen).toHaveBeenCalledOnce();
  });

  it('updates the translated title and focuses only on subsequent path changes without a portal', async () => {
    const content = fixture.nativeElement.querySelector('div') as HTMLElement;
    const focus = vi.spyOn(content, 'focus');
    route.data['titleKey'] = 'Collection';
    routerEvents.next(new NavigationEnd(1, '/collection/library', '/collection/library'));
    await fixture.whenStable();
    expect(title.setTitle).toHaveBeenLastCalledWith('Collection | AppTitle');
    expect(focus).not.toHaveBeenCalled();

    routerEvents.next(new NavigationEnd(2, '/collection/library?favorite=true', '/collection/library?favorite=true'));
    expect(focus).not.toHaveBeenCalled();
    route.data['titleKey'] = 'Books';
    routerEvents.next(new NavigationEnd(3, '/collection/books', '/collection/books'));
    await fixture.whenStable();
    expect(title.setTitle).toHaveBeenLastCalledWith('Books | AppTitle');
    expect(focus).toHaveBeenCalledOnce();

    portal.componentRef.mockReturnValue({});
    routerEvents.next(new NavigationEnd(4, '/settings/basics', '/settings/basics'));
    expect(focus).toHaveBeenCalledOnce();
  });
});
