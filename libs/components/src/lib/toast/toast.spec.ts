import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './toast';
import { initialToastState, toastStateToken } from './toast-store';

describe('Toast component', () => {
  let fixture: ComponentFixture<Toast>;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [Toast],
      providers: [provideStore(initialToastState, toastStateToken)],
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
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('Saved!');

    component['onToastClick']();
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
