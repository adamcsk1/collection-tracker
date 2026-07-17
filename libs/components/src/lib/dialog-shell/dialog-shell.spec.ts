import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevealLabel } from '../reveal-label/reveal-label';
import { DialogShell } from './dialog-shell';

@Component({
  selector: 'libc-test-dialog-shell-host',
  imports: [DialogShell],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
    </libc-dialog-shell>
    <button id="other">Other focusable</button>
  `,
})
class HostComponent {}

@Component({
  selector: 'libc-test-dialog-shell-custom-close-host',
  imports: [DialogShell],
  template: `
    <libc-dialog-shell [closeWithPortal]="false" (closed)="onClosed()">
      <div dialog-shell-content>Content</div>
    </libc-dialog-shell>
  `,
})
class CustomCloseHostComponent {
  public readonly onClosed = vi.fn();
}

@Component({
  selector: 'libc-test-dialog-shell-labelled-host',
  imports: [DialogShell],
  template: `
    <libc-dialog-shell [ariaLabelledBy]="'test-dialog-title'">
      <h3 id="test-dialog-title" dialog-shell-top-content>Dialog title</h3>
      <div dialog-shell-content>Content</div>
    </libc-dialog-shell>
  `,
})
class LabelledHostComponent {}

@Component({
  selector: 'libc-test-dialog-shell-menu-host',
  imports: [DialogShell, RevealLabel],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
      <button
        type="button"
        class="button-icon button-reveal-label"
        libcRevealLabel="Projected action"
        aria-label="Projected action"
        dialog-shell-menu-content
        (click)="onAction()"
      >
        <i class="material-icons" aria-hidden="true">edit</i>
        <span class="button-reveal-label-text"><span>Projected action</span></span>
      </button>
    </libc-dialog-shell>
  `,
})
class MenuHostComponent {
  public readonly onAction = vi.fn();
}

@Component({
  selector: 'libc-test-dialog-shell-footer-host',
  imports: [DialogShell, RevealLabel],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
      <div dialog-shell-bottom-content>
        <button
          type="button"
          class="button-icon button-reveal-label"
          libcRevealLabel="Footer action"
          data-test-id="footer-action"
          aria-label="Footer action"
          (click)="onAction()"
        >
          <i class="material-icons" aria-hidden="true">save</i>
          <span class="button-reveal-label-text"><span>Footer action</span></span>
        </button>
        <button
          type="button"
          class="button-icon button-reveal-label"
          libcRevealLabel="Disabled footer action"
          data-test-id="disabled-footer-action"
          aria-label="Disabled footer action"
          disabled
        >
          <i class="material-icons" aria-hidden="true">block</i>
          <span class="button-reveal-label-text"><span>Disabled footer action</span></span>
        </button>
      </div>
    </libc-dialog-shell>
  `,
})
class FooterHostComponent {
  public readonly onAction = vi.fn();
}

@Component({
  selector: 'libc-test-dialog-shell-dynamic-menu-host',
  imports: [DialogShell],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
      <div dialog-shell-menu-content>
        @if (showActions()) {
          <button type="button">Projected action</button>
        }
      </div>
    </libc-dialog-shell>
  `,
})
class DynamicMenuHostComponent {
  public readonly showActions = signal(false);
}

describe('DialogShell component', () => {
  let closeSpy: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<HostComponent>;

  const finishCloseAnimation = (): void => {
    vi.advanceTimersByTime(200);
  };

  const finishActionHold = (): void => {
    vi.advanceTimersByTime(500);
  };

  const delaySynthesizedClick = (): void => {
    vi.advanceTimersByTime(100);
  };

  const finishClickSuppressionFallback = (): void => {
    vi.advanceTimersByTime(1000);
  };

  const setViewport = (width: number, isMobile: boolean): void => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(width <= 650px)' ? isMobile : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  };

  const dispatchPointerEvent = (
    element: HTMLElement,
    type: string,
    clientY: number,
    clientX = 0,
    pointerId = 1,
    pointerType = 'touch'
  ): void => {
    const event = new Event(type, { bubbles: true }) as PointerEvent;
    Object.defineProperties(event, {
      clientY: { value: clientY },
      clientX: { value: clientX },
      pointerId: { value: pointerId },
      pointerType: { value: pointerType },
      isPrimary: { value: true },
    });
    element.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    setViewport(1024, false);
    closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PortalService, useValue: { closeTop: closeSpy } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses dialog root on init', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    expect(document.activeElement).toBe(dialogRoot);
  });

  it('keeps tab focus inside the dialog', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLButtonElement;
    const otherFocusable = fixture.nativeElement.querySelector('#other') as HTMLButtonElement;
    dragHandle.focus();

    dragHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

    expect(document.activeElement).toBe(dragHandle);
    expect(document.activeElement).not.toBe(otherFocusable);
  });

  it('restores focus to the previously focused element after close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const restoreFixture = TestBed.createComponent(HostComponent);
    restoreFixture.detectChanges();
    const overlay = restoreFixture.nativeElement.querySelector('.dialog-overlay') as HTMLButtonElement;

    overlay.click();
    finishCloseAnimation();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('calls portal.closeTop when the drag handle is pulled down', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLElement;

    dispatchPointerEvent(dragHandle, 'pointerdown', 100);
    dispatchPointerEvent(dragHandle, 'pointerup', 160);
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('closes after a short drag movement', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLElement;

    dispatchPointerEvent(dragHandle, 'pointerdown', 100);
    dispatchPointerEvent(dragHandle, 'pointerup', 132);
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('labels the drag handle as a close control', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLButtonElement;

    expect(dragHandle.type).toBe('button');
    expect(dragHandle.getAttribute('aria-label')).toBe('DragToClose');
  });

  it('uses the provided label element as the dialog accessible name', () => {
    const labelledFixture = TestBed.createComponent(LabelledHostComponent);
    labelledFixture.detectChanges();

    const dialogRoot = labelledFixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    expect(dialogRoot.getAttribute('aria-labelledby')).toBe('test-dialog-title');
  });

  it('calls portal.closeTop when the drag handle is activated by keyboard', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLButtonElement;

    dragHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('moves the dialog frame with downward drag movement', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLElement;

    dispatchPointerEvent(dragHandle, 'pointerdown', 100);
    dispatchPointerEvent(dragHandle, 'pointermove', 130);
    fixture.detectChanges();

    expect(dialogRoot.style.transform).toBe('translateY(30px)');
  });

  it('does not move the dialog frame above its start position', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLElement;

    dispatchPointerEvent(dragHandle, 'pointerdown', 100);
    dispatchPointerEvent(dragHandle, 'pointermove', 80);
    fixture.detectChanges();

    expect(dialogRoot.style.transform).toBe('');
  });

  it('does not close when the drag handle movement is below the threshold', () => {
    const dragHandle = fixture.nativeElement.querySelector('[data-test-id="dialog-drag-handle"]') as HTMLElement;

    dispatchPointerEvent(dragHandle, 'pointerdown', 100);
    dispatchPointerEvent(dragHandle, 'pointerup', 120);
    dragHandle.click();
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('calls portal.closeTop when swiping in from the mobile left edge', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 90);
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('calls portal.closeTop when swiping in from the mobile right edge', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 388);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 300);
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not close from an edge swipe on desktop viewports', () => {
    setViewport(1024, false);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 90);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close when a mobile swipe starts away from the screen edge', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 100);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 190);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close when a mobile edge swipe moves outward', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 0);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close when vertical movement dominates a mobile edge swipe', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogRoot, 'pointerup', 190, 80);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close from a non-touch edge drag on mobile viewports', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2, 1, 'mouse');
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 90, 1, 'mouse');
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close when a mobile edge swipe starts from dialog content', () => {
    setViewport(390, true);
    const dialogContent = fixture.nativeElement.querySelector('[dialog-shell-content]') as HTMLElement;

    dispatchPointerEvent(dialogContent, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogContent, 'pointerup', 108, 90);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close after a mobile edge swipe is cancelled', () => {
    setViewport(390, true);
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;

    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 2);
    dispatchPointerEvent(dialogRoot, 'pointercancel', 104, 40);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 90);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not close from a mobile edge swipe starting on the actions area', () => {
    setViewport(390, true);
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const menu = menuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu"]') as HTMLElement;

    dispatchPointerEvent(menu, 'pointerdown', 100, 388);
    dispatchPointerEvent(menu, 'pointerup', 108, 300);
    finishCloseAnimation();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('calls portal.closeTop when Escape key is pressed', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    dialogRoot?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('calls portal.closeTop when backdrop is clicked', () => {
    const overlay = fixture.nativeElement.querySelector('.dialog-overlay') as HTMLButtonElement;
    overlay?.click();
    finishCloseAnimation();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('emits closed without portal close when portal close is disabled', () => {
    const customFixture = TestBed.createComponent(CustomCloseHostComponent);
    customFixture.detectChanges();
    const overlay = customFixture.nativeElement.querySelector('.dialog-overlay') as HTMLButtonElement;

    overlay.click();
    finishCloseAnimation();

    expect(customFixture.componentInstance.onClosed).toHaveBeenCalledTimes(1);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('shows projected actions inline', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();

    const closeButton = menuFixture.nativeElement.querySelector('[data-test-id="dialog-close-button"]');
    const actions = menuFixture.nativeElement.querySelector('.dialog-actions') as HTMLElement;

    expect(closeButton).toBeNull();
    expect(actions.hasAttribute('hidden')).toBe(false);

    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;
    const projectedActionLabel = projectedAction.querySelector('.button-reveal-label-text');

    expect(projectedAction.classList.contains('button-reveal-label')).toBe(true);
    expect(projectedAction.classList.contains('button-icon')).toBe(true);
    expect(projectedAction.getAttribute('aria-label')).toBe('Projected action');
    expect(projectedActionLabel?.textContent).toContain('Projected action');

    projectedAction.click();
    menuFixture.detectChanges();

    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
    expect(actions.hasAttribute('hidden')).toBe(false);

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('executes a projected action after a quick touch tap', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    dispatchPointerEvent(projectedAction, 'pointerup', 100, 100);
    projectedAction.click();

    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
    expect(menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('shows a touch hold label without executing the projected action', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;
    const dialogRoot = menuFixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    vi.spyOn(dialogRoot, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 0, 300, 200));
    vi.spyOn(projectedAction, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 8, 40, 24));
    projectedAction.setAttribute('aria-describedby', 'existing-description');

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    finishActionHold();
    menuFixture.detectChanges();

    const tooltip = menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]') as HTMLElement;
    const tooltipHost = tooltip.closest('libc-tooltip') as HTMLElement;
    expect(tooltip.textContent).toContain('Projected action');
    expect(tooltip.style.left).toBe('100px');
    expect(tooltipHost.style.bottom).toBe('192px');
    expect(projectedAction.getAttribute('aria-describedby')).toBe(`existing-description ${tooltip.id}`);

    dispatchPointerEvent(projectedAction, 'pointerup', 100, 100);
    menuFixture.detectChanges();
    expect(projectedAction.getAttribute('aria-describedby')).toBe(`existing-description ${tooltip.id}`);
    delaySynthesizedClick();
    projectedAction.click();

    expect(menuFixture.componentInstance.onAction).not.toHaveBeenCalled();
    vi.advanceTimersByTime(900);
    expect(projectedAction.getAttribute('aria-describedby')).toBe('existing-description');
    expect(menuFixture.nativeElement.querySelector('libc-tooltip')).toBeNull();

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    expect(projectedAction.getAttribute('aria-describedby')).toBe('existing-description');
    dispatchPointerEvent(projectedAction, 'pointerup', 100, 100);
    projectedAction.click();

    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
  });

  it('executes a projected footer action after a quick touch tap', () => {
    const footerFixture = TestBed.createComponent(FooterHostComponent);
    footerFixture.detectChanges();
    const footerAction = footerFixture.nativeElement.querySelector(
      '[data-test-id="footer-action"]'
    ) as HTMLButtonElement;

    dispatchPointerEvent(footerAction, 'pointerdown', 180, 100);
    dispatchPointerEvent(footerAction, 'pointerup', 180, 100);
    footerAction.click();

    expect(footerFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
    expect(footerFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('shows a frame-positioned touch hold label without executing a projected footer action', () => {
    const footerFixture = TestBed.createComponent(FooterHostComponent);
    footerFixture.detectChanges();
    const dialogRoot = footerFixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    const footerAction = footerFixture.nativeElement.querySelector(
      '[data-test-id="footer-action"]'
    ) as HTMLButtonElement;
    vi.spyOn(dialogRoot, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 10, 300, 200));
    vi.spyOn(footerAction, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 170, 40, 24));

    dispatchPointerEvent(footerAction, 'pointerdown', 180, 100);
    finishActionHold();
    footerFixture.detectChanges();

    const tooltip = footerFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]') as HTMLElement;
    const tooltipHost = tooltip.closest('libc-tooltip') as HTMLElement;
    expect(tooltip.textContent).toContain('Footer action');
    expect(tooltip.style.left).toBe('100px');
    expect(tooltipHost.style.bottom).toBe('40px');

    dispatchPointerEvent(footerAction, 'pointerup', 180, 100);
    delaySynthesizedClick();
    footerAction.click();

    expect(footerFixture.componentInstance.onAction).not.toHaveBeenCalled();
  });

  it('ignores touch holds on disabled projected footer actions', () => {
    const footerFixture = TestBed.createComponent(FooterHostComponent);
    footerFixture.detectChanges();
    const disabledFooterAction = footerFixture.nativeElement.querySelector(
      '[data-test-id="disabled-footer-action"]'
    ) as HTMLButtonElement;

    dispatchPointerEvent(disabledFooterAction, 'pointerdown', 180, 100);
    finishActionHold();
    footerFixture.detectChanges();

    expect(footerFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('cancels the touch hold label when the pointer moves', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    dispatchPointerEvent(projectedAction, 'pointermove', 100, 109);
    finishActionHold();
    menuFixture.detectChanges();

    expect(menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('suppresses the action when the pointer moves after a touch hold', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    finishActionHold();
    dispatchPointerEvent(projectedAction, 'pointermove', 100, 109);
    menuFixture.detectChanges();
    dispatchPointerEvent(projectedAction, 'pointerup', 100, 109);
    delaySynthesizedClick();
    projectedAction.click();

    expect(menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
    expect(menuFixture.componentInstance.onAction).not.toHaveBeenCalled();
  });

  it('releases click suppression when a touch hold produces no click', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    finishActionHold();
    dispatchPointerEvent(projectedAction, 'pointerup', 100, 100);
    finishClickSuppressionFallback();
    projectedAction.click();

    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
  });

  it('cancels the touch hold label when the pointer is cancelled', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100);
    dispatchPointerEvent(projectedAction, 'pointercancel', 100, 100);
    finishActionHold();
    menuFixture.detectChanges();

    expect(menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('does not show a hold label for mouse input', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;

    dispatchPointerEvent(projectedAction, 'pointerdown', 100, 100, 1, 'mouse');
    finishActionHold();
    projectedAction.click();
    menuFixture.detectChanges();

    expect(menuFixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
  });

  it('detects projected actions added after initialization', async () => {
    const dynamicMenuFixture = TestBed.createComponent(DynamicMenuHostComponent);
    dynamicMenuFixture.detectChanges();
    dynamicMenuFixture.detectChanges();

    const actions = dynamicMenuFixture.nativeElement.querySelector('.dialog-actions') as HTMLElement;

    expect(actions.hasAttribute('hidden')).toBe(true);

    dynamicMenuFixture.componentInstance.showActions.set(true);
    dynamicMenuFixture.detectChanges();
    await Promise.resolve();
    dynamicMenuFixture.detectChanges();

    expect(actions.hasAttribute('hidden')).toBe(false);
  });
});
