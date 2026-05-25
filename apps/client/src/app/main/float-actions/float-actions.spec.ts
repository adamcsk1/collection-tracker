import { Component } from '@angular/core';
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

@Component({
  selector: 'ct-test-float-action-buttons',
  template: '<button data-test-id="test-action-button">test</button>',
})
class TestFloatActionButtons {}

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
    service.updateConfig({ actionsAvailable: true });
    fixture.detectChanges();
  });

  it('opens the action menu from the float button', () => {
    service.setActionsComponent(TestFloatActionButtons);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="test-action-button"]')).toBeTruthy();
  });

  it('offsets scroll-to-top when the registered action menu is expanded', () => {
    service.setActionsComponent(TestFloatActionButtons);
    service.setActionButtonsVisible(true);
    service.updateConfig({ scrollToTopAvailable: true });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.float-button-scroll-to-top-actions-offset')).toBeTruthy();
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
    service.setActionsComponent(TestFloatActionButtons);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-test-id="test-action-button"]')).toBeTruthy();

    service.resetActions();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="test-action-button"]')).toBeNull();
  });
});
