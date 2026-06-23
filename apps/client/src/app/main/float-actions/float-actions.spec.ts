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

  it('does not offset scroll-to-top when the registered action menu is expanded', () => {
    service.setActionsComponent(TestFloatActionButtons);
    service.setActionButtonsVisible(true);
    service.updateConfig({ scrollToTopAvailable: true });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="scroll-to-top"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.float-button-scroll-to-top-actions-offset')).toBeNull();
  });

  it('renders scroll-to-top as a labelled icon button outside the action slot', () => {
    service.setActionsComponent(TestFloatActionButtons);
    service.updateConfig({ scrollToTopAvailable: true });

    fixture.detectChanges();

    const scrollButton = fixture.nativeElement.querySelector('[data-test-id="scroll-to-top"]');
    expect(fixture.nativeElement.querySelector('.float-actions-slot [data-test-id="scroll-to-top"]')).toBeNull();
    expect(scrollButton.querySelector('.material-icons')?.textContent.trim()).toBe('arrow_upward');
    expect(scrollButton.textContent).toContain('ScrollToTop');
  });

  it('renders scroll-to-top when no action component is registered', () => {
    service.updateConfig({ scrollToTopAvailable: true });

    fixture.detectChanges();

    const scrollToTop = fixture.nativeElement.querySelector('[data-test-id="scroll-to-top"]');
    expect(scrollToTop).toBeTruthy();
    expect(scrollToTop.parentElement.classList).toContain('float-button-scroll-to-top-no-search-bar');
    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-bar"]').classList).toContain(
      'float-search-bar-menu-only'
    );
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

  it('marks the float bar as menu-only when no search or actions are registered', () => {
    service.setSearchTemplate(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-bar"]').classList).toContain(
      'float-search-bar-menu-only'
    );
  });

  it('marks the float bar as no-search when actions render without a search template', () => {
    service.setSearchTemplate(null);
    service.setActionsComponent(TestFloatActionButtons);
    fixture.detectChanges();

    const floatSearchBar = fixture.nativeElement.querySelector('[data-test-id="float-search-bar"]');
    expect(floatSearchBar.classList).toContain('float-search-bar-no-search');
    expect(floatSearchBar.classList).not.toContain('float-search-bar-menu-only');
    expect(fixture.nativeElement.querySelector('[data-test-id="scroll-to-top"]')).toBeNull();
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
