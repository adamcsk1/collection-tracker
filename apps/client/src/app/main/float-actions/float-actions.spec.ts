import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuDialog } from '../menu-dialog/menu-dialog';
import { initialMainState, mainStateToken } from '../main-store';
import { FloatActions } from './float-actions';
import { FloatActionsService } from './float-actions-service';

describe('FloatActions', () => {
  let fixture: ComponentFixture<FloatActions>;
  let component: FloatActions;
  let service: FloatActionsService;
  let portal: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [FloatActions],
      providers: [
        FloatActionsService,
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    fixture = TestBed.createComponent(FloatActions);
    component = fixture.componentInstance;
    service = TestBed.inject(FloatActionsService);
    service.updateConfig({ showActions: true, collectionLength: 1 });
    fixture.detectChanges();
  });

  it('opens the action menu from the float button', () => {
    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="add-new"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="random-pick"]')).toBeTruthy();
  });

  it('runs registered callbacks and closes the action menu', () => {
    const addNew = vi.fn();
    service.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      scrollToTop: vi.fn(),
      showFunctions: vi.fn(),
    });
    component['onShowFunctions']();

    component['onAddNew']();
    fixture.detectChanges();

    expect(addNew).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeNull();
  });

  it('opens the mobile menu dialog', () => {
    component['onOpenMenu']();

    expect(portal.open).toHaveBeenCalledWith(MenuDialog);
  });

  it('renders the mobile menu button when no search template is registered', () => {
    service.setSearchTemplate(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="nav-menu-button"]')).toBeTruthy();
  });

  it('collapses the action menu when actions reset', () => {
    component['onShowFunctions']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeTruthy();

    service.resetActions();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeNull();
  });
});
