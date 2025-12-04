import { TestBed } from '@angular/core/testing';
import { provideStore } from 'ngx-simple-signal-store';
import { Toast } from './toast';
import { initialToastState, toastStateToken } from './toast-store';

describe('Toast component', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [Toast],
      providers: [provideStore(initialToastState, toastStateToken)],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides when clicked', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('message', 'Saved!');

    const fixture = TestBed.createComponent(Toast);
    fixture.detectChanges();

    const toastElement = fixture.nativeElement.querySelector('p') as HTMLElement;
    expect(toastElement.textContent?.trim()).toBe('Saved!');

    toastElement.click();
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
  });

  it('auto hides after timeout', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 10);
    toastStore.setState('message', 'Auto hide');

    const fixture = TestBed.createComponent(Toast);
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('Auto hide');

    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
    expect(toastStore.state.timeout()).toBe(initialToastState.timeout);
  });

  it('restarts timer when message changes while visible', () => {
    const toastStore = TestBed.inject(toastStateToken);
    toastStore.setState('timeout', 5);
    toastStore.setState('message', 'First');

    const fixture = TestBed.createComponent(Toast);
    fixture.detectChanges();

    toastStore.setState('timeout', 20);
    toastStore.setState('message', 'Second');
    jest.advanceTimersByTime(5);
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('Second');

    jest.advanceTimersByTime(20);
    fixture.detectChanges();

    expect(toastStore.state.message()).toBe('');
  });
});
