import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { asyncScheduler, Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevealLabel } from './reveal-label';

@Component({
  selector: 'libc-test-reveal-label-host',
  imports: [RevealLabel],
  template: `
    <div class="dialog-frame">
      <button type="button" libcRevealLabel="Save" aria-describedby="existing-description" (click)="onSave()">
        <i class="material-icons" aria-hidden="true">save</i>
        <span class="button-reveal-label-text"><span>Save</span></span>
      </button>
    </div>
  `,
})
class HostComponent {
  public readonly onSave = vi.fn();
}

describe('RevealLabel directive', () => {
  let fixture: ComponentFixture<HostComponent>;
  let button: HTMLButtonElement;

  const dispatchPointerEvent = (type: string, clientX = 100, clientY = 100, pointerType = 'touch'): void => {
    const event = new Event(type, { bubbles: true }) as PointerEvent;
    Object.defineProperties(event, {
      clientX: { value: clientX },
      clientY: { value: clientY },
      pointerId: { value: 1 },
      pointerType: { value: pointerType },
      isPrimary: { value: true },
    });
    button.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds the reveal label styling contract', () => {
    expect(button.classList.contains('button-reveal-label')).toBe(true);
  });

  it('executes a quick touch tap', () => {
    dispatchPointerEvent('pointerdown');
    dispatchPointerEvent('pointerup');
    button.click();

    expect(fixture.componentInstance.onSave).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('shows the label on touch hold and suppresses the resulting click', () => {
    const dialogFrame = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    vi.spyOn(dialogFrame, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 10, 300, 200));
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 170, 40, 24));

    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]') as HTMLElement;
    expect(tooltip.textContent).toContain('Save');
    expect(tooltip.style.left).toBe('100px');
    expect(tooltip.closest('libc-tooltip')?.getAttribute('style')).toContain('bottom: 40px');
    expect(button.getAttribute('aria-describedby')).toBe(`existing-description ${tooltip.id}`);

    dispatchPointerEvent('pointerup');
    button.click();

    expect(fixture.componentInstance.onSave).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-describedby')).toBe(`existing-description ${tooltip.id}`);
    expect(fixture.nativeElement.querySelector('libc-tooltip')).not.toBeNull();

    vi.advanceTimersByTime(999);
    expect(fixture.nativeElement.querySelector('libc-tooltip')).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(button.getAttribute('aria-describedby')).toBe('existing-description');
    expect(fixture.nativeElement.querySelector('libc-tooltip')).toBeNull();
  });

  it('cancels a hold when touch movement exceeds the tolerance', () => {
    dispatchPointerEvent('pointerdown');
    dispatchPointerEvent('pointermove', 109);
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('keeps a hold active while touch movement stays within tolerance', () => {
    dispatchPointerEvent('pointerdown');
    dispatchPointerEvent('pointermove', 108, 108);
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).not.toBeNull();
  });

  it.each(['mouse', 'pen'])('ignores %s pointer holds', (pointerType) => {
    dispatchPointerEvent('pointerdown', 100, 100, pointerType);
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('ignores pointer holds while disabled', () => {
    button.disabled = true;
    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('ignores non-primary pointer holds', () => {
    const event = new Event('pointerdown', { bubbles: true }) as PointerEvent;
    Object.defineProperties(event, {
      clientX: { value: 100 },
      clientY: { value: 100 },
      pointerId: { value: 1 },
      pointerType: { value: 'touch' },
      isPrimary: { value: false },
    });
    button.dispatchEvent(event);
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('clears a shown tooltip when held touch moves beyond tolerance', () => {
    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).not.toBeNull();

    dispatchPointerEvent('pointermove', 109);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('resets an active hold when pointer starts outside the button', () => {
    dispatchPointerEvent('pointerdown');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(500);

    expect(fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('prevents context menu while suppressing the held touch click', () => {
    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    button.dispatchEvent(contextMenuEvent);

    expect(contextMenuEvent.defaultPrevented).toBe(true);
  });

  it('does not show a tooltip without a container', () => {
    const directive = fixture.debugElement.query(By.directive(RevealLabel)).injector.get(RevealLabel);
    button.remove();

    directive['showTooltip']();

    expect(document.querySelector('[data-test-id="reveal-label-tooltip"]')).toBeNull();
  });

  it('cancels the previous dismissal schedule when another hold starts', () => {
    const dialogFrame = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    vi.spyOn(dialogFrame, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 10, 300, 200));
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 170, 40, 24));

    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    dispatchPointerEvent('pointerup');

    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    const tooltip = fixture.nativeElement.querySelector('[data-test-id="reveal-label-tooltip"]') as HTMLElement;

    vi.advanceTimersByTime(500);

    expect(tooltip.isConnected).toBe(true);
  });

  it('unsubscribes from pending schedules when destroyed', () => {
    const scheduleSpy = vi.spyOn(asyncScheduler, 'schedule');
    dispatchPointerEvent('pointerdown');
    vi.advanceTimersByTime(500);
    dispatchPointerEvent('pointerup');
    const subscriptions = scheduleSpy.mock.results.map((result) => result.value as Subscription);

    expect(subscriptions).toHaveLength(3);
    expect(subscriptions.slice(1).every((subscription) => !subscription.closed)).toBe(true);

    fixture.destroy();

    expect(subscriptions.slice(1).every((subscription) => subscription.closed)).toBe(true);
  });
});
