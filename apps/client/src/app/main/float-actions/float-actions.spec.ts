import { Component, TemplateRef, ViewChild } from '@angular/core';
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

@Component({
  selector: 'ct-test-search-template',
  template: `
    <ng-template #standardSearch>
      <input data-test-id="projected-search" />
    </ng-template>
  `,
})
class TestSearchTemplate {
  @ViewChild('standardSearch', { static: true }) public standardSearch!: TemplateRef<unknown>;
}

describe('FloatActions', () => {
  let fixture: ComponentFixture<FloatActions>;
  let component: FloatActions;
  let service: FloatActionsService;
  let portal: { open: ReturnType<typeof vi.fn> };
  let searchTemplateFixture: ComponentFixture<TestSearchTemplate>;

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
    searchTemplateFixture = TestBed.createComponent(TestSearchTemplate);
    searchTemplateFixture.detectChanges();
    service.updateConfig({ actionsAvailable: true });
    fixture.detectChanges();
  });

  it('opens the action menu from the float button', () => {
    service.setActionsComponent(TestFloatActionButtons);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="test-action-button"]')).toBeTruthy();
  });

  it('hides scroll-to-top when the registered action menu is expanded', () => {
    service.setActionsComponent(TestFloatActionButtons);
    service.setActionButtonsVisible(true);
    service.updateConfig({ scrollToTopAvailable: true });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="scroll-to-top"]')).toBeNull();
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

  it('marks the float actions as scrolling when configured', () => {
    service.updateConfig({ scrolling: true });

    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('float-actions-scrolling');
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

  it('renders a collapsed search button before showing a registered search template', () => {
    service.setSearchTemplate(searchTemplateFixture.componentInstance.standardSearch);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="projected-search"]')).toBeNull();
  });

  it('shows and focuses the registered search template from the collapsed search button', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
    service.setSearchTemplate(searchTemplateFixture.componentInstance.standardSearch);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]').click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();

    const searchInput = fixture.nativeElement.querySelector('[data-test-id="projected-search"]');
    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-bar"]').classList).toContain(
      'float-search-bar-search-expanded'
    );
    expect(searchInput).toBeTruthy();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the registered search template open when focus leaves it', async () => {
    service.setSearchTemplate(searchTemplateFixture.componentInstance.standardSearch);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]').click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();

    const searchInput = fixture.nativeElement.querySelector('[data-test-id="projected-search"]');
    fixture.nativeElement.querySelector('[data-test-id="nav-menu-button"]').focus();
    searchInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="projected-search"]')).toBeTruthy();
  });

  it('collapses the registered search template when clicking outside float actions', async () => {
    service.setSearchTemplate(searchTemplateFixture.componentInstance.standardSearch);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]').click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="projected-search"]')).toBeNull();
  });

  it('collapses the registered search template when scrolling starts', async () => {
    service.setSearchTemplate(searchTemplateFixture.componentInstance.standardSearch);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]').click();
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();

    service.updateConfig({ scrolling: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="projected-search"]')).toBeNull();
  });

  it('runs the registered search action without rendering a search template', () => {
    const searchAction = vi.fn();
    service.setSearchTemplate(null, searchAction);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="float-search-toggle"]').click();
    fixture.detectChanges();

    expect(searchAction).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-test-id="ai-search-trigger"]')).toBeNull();
  });

  it('renders the AI search button when AI search is available', () => {
    service.setAiSearchAction(true, false, vi.fn());
    fixture.detectChanges();

    const aiButton = fixture.nativeElement.querySelector('[data-test-id="float-ai-search-button"]');
    expect(aiButton).toBeTruthy();
    expect(aiButton.getAttribute('aria-pressed')).toBe('false');
    expect(aiButton.classList.contains('ai-search-button-active')).toBe(false);
  });

  it('hides the AI search button when AI search is unavailable', () => {
    service.setAiSearchAction(false, false, vi.fn());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="float-ai-search-button"]')).toBeNull();
  });

  it('marks the AI search button active and runs the registered callback', () => {
    const aiSearchAction = vi.fn();
    service.setAiSearchAction(true, true, aiSearchAction);
    fixture.detectChanges();

    const aiButton = fixture.nativeElement.querySelector('[data-test-id="float-ai-search-button"]');
    expect(aiButton.getAttribute('aria-pressed')).toBe('true');
    expect(aiButton.classList.contains('ai-search-button-active')).toBe(true);

    aiButton.click();
    fixture.detectChanges();

    expect(aiSearchAction).toHaveBeenCalledTimes(1);
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
