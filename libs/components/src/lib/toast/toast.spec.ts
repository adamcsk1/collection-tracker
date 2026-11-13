import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideStore } from 'ngx-simple-signal-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './toast';
import { initialToastState, toastStateToken } from './toast-store';

describe('Toast component', () => {
  let fixture: ComponentFixture<Toast>;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [Toast],
      providers: [
        provideStore(initialToastState, toastStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    fixture = TestBed.createComponent(Toast);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides when clicked', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('message', 'Saved!');
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('Saved!');

    const message = fixture.nativeElement.querySelector('[data-test-id="toast-message"]') as HTMLElement;
    expect(message.hasAttribute('tabindex')).toBe(false);
    message.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(toastStore.state.message()).toBe('Saved!');
    const dismiss = fixture.nativeElement.querySelector('[data-test-id="toast-dismiss"]') as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('Close');
    expect(dismiss).toHaveClass('button-icon');
    dismiss.click();
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
  });

  it('auto hides after timeout', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 10);
    toastStore.setState('message', 'Auto hide');

    expect(toastStore.state.message()).toBe('Auto hide');

    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
    expect(toastStore.state.timeout()).toBe(initialToastState.timeout);
  });

  it('updates a persistent live region when a toast appears and disappears', () => {
    const toastStore = TestBed.inject(toastStateToken);
    const announcement = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(announcement.textContent?.trim()).toBe('');

    toastStore.setState('message', 'Saved!');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBe(announcement);
    expect(announcement.textContent?.trim()).toBe('Saved!');

    vi.runOnlyPendingTimers();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBe(announcement);
    expect(announcement.textContent?.trim()).toBe('');
  });

  it('defers expiry while the dismiss button is focused until it loses focus', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 10);
    toastStore.setState('message', 'Auto hide');
    fixture.detectChanges();
    const dismiss = fixture.nativeElement.querySelector('[data-test-id="toast-dismiss"]') as HTMLButtonElement;
    dismiss.dispatchEvent(new FocusEvent('focus'));

    vi.advanceTimersByTime(10);
    fixture.detectChanges();
    expect(toastStore.state.message()).toBe('Auto hide');

    dismiss.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(toastStore.state.message()).toBe('');
    expect(toastStore.state.timeout()).toBe(initialToastState.timeout);
  });

  it('clears deferred expiry when a new message restarts the timer', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 10);
    toastStore.setState('message', 'First');
    fixture.detectChanges();
    const dismiss = fixture.nativeElement.querySelector('[data-test-id="toast-dismiss"]') as HTMLButtonElement;
    dismiss.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(10);

    toastStore.setState('message', 'Second');
    fixture.detectChanges();
    dismiss.dispatchEvent(new FocusEvent('blur'));
    expect(toastStore.state.message()).toBe('Second');
    vi.advanceTimersByTime(10);
    expect(toastStore.state.message()).toBe('');
  });

  it('restarts timer when message changes while visible', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 5);
    toastStore.setState('message', 'First');

    toastStore.setState('timeout', 20);
    toastStore.setState('message', 'Second');
    vi.advanceTimersByTime(5);
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('Second');

    vi.advanceTimersByTime(20);
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
  });
});
