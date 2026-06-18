import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  imports: [DialogShell],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
      <button type="button" dialog-shell-menu-content (click)="onAction()">Projected action</button>
    </libc-dialog-shell>
  `,
})
class MenuHostComponent {
  public readonly onAction = vi.fn();
}

@Component({
  selector: 'libc-test-dialog-shell-dynamic-menu-host',
  imports: [DialogShell],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
      @if (showActions()) {
        <button type="button" dialog-shell-menu-content>Projected action</button>
      }
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

  it('does not close from a mobile edge swipe while the actions menu is open', () => {
    setViewport(390, true);
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();
    const dialogRoot = menuFixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    const menuButton = menuFixture.nativeElement.querySelector(
      '[data-test-id="dialog-actions-menu-button"]'
    ) as HTMLButtonElement;

    menuButton.click();
    menuFixture.detectChanges();
    dispatchPointerEvent(dialogRoot, 'pointerdown', 100, 388);
    dispatchPointerEvent(dialogRoot, 'pointerup', 108, 300);
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

  it('shows projected actions in a three-dot menu', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();

    const closeButton = menuFixture.nativeElement.querySelector('[data-test-id="dialog-close-button"]');
    const menuButton = menuFixture.nativeElement.querySelector(
      '[data-test-id="dialog-actions-menu-button"]'
    ) as HTMLButtonElement;
    const menu = menuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu"]') as HTMLElement;

    expect(closeButton).toBeNull();
    expect(menuButton).not.toBeNull();
    expect(menu.hasAttribute('hidden')).toBe(true);

    menuButton.click();
    menuFixture.detectChanges();

    expect(menu.hasAttribute('hidden')).toBe(false);

    const projectedAction = menuFixture.nativeElement.querySelector('[dialog-shell-menu-content]') as HTMLButtonElement;
    projectedAction.click();
    menuFixture.detectChanges();

    expect(menuFixture.componentInstance.onAction).toHaveBeenCalledTimes(1);
    expect(menu.hasAttribute('hidden')).toBe(true);

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('closes the actions menu when clicking outside of it', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();

    const menuButton = menuFixture.nativeElement.querySelector(
      '[data-test-id="dialog-actions-menu-button"]'
    ) as HTMLButtonElement;
    const menu = menuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu"]') as HTMLElement;
    const content = menuFixture.nativeElement.querySelector('[dialog-shell-content]') as HTMLElement;

    menuButton.click();
    menuFixture.detectChanges();

    expect(menu.hasAttribute('hidden')).toBe(false);

    content.click();
    menuFixture.detectChanges();

    expect(menu.hasAttribute('hidden')).toBe(true);
  });

  it('closes the actions menu when clicking the menu content', () => {
    const menuFixture = TestBed.createComponent(MenuHostComponent);
    menuFixture.detectChanges();
    menuFixture.detectChanges();

    const menuButton = menuFixture.nativeElement.querySelector(
      '[data-test-id="dialog-actions-menu-button"]'
    ) as HTMLButtonElement;
    const menu = menuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu"]') as HTMLElement;
    const menuContent = menuFixture.nativeElement.querySelector('.dialog-actions-menu-content') as HTMLElement;

    menuButton.click();
    menuFixture.detectChanges();

    expect(menu.hasAttribute('hidden')).toBe(false);

    menuContent.click();
    menuFixture.detectChanges();

    expect(menu.hasAttribute('hidden')).toBe(true);
  });

  it('detects projected actions added after initialization', async () => {
    const dynamicMenuFixture = TestBed.createComponent(DynamicMenuHostComponent);
    dynamicMenuFixture.detectChanges();
    dynamicMenuFixture.detectChanges();

    expect(dynamicMenuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu-button"]')).toBeNull();

    dynamicMenuFixture.componentInstance.showActions.set(true);
    dynamicMenuFixture.detectChanges();
    await Promise.resolve();
    dynamicMenuFixture.detectChanges();

    expect(
      dynamicMenuFixture.nativeElement.querySelector('[data-test-id="dialog-actions-menu-button"]')
    ).not.toBeNull();
  });
});
