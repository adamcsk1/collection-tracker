import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { BlockerLoading } from './blocker-loading';
import { BLOCKER_LOADING_TIMEOUT_MS } from './blocker-loading-const';
import { blockerLoadingStateToken, initialBlockerLoadingState } from './blocker-loading-store';

describe('BlockerLoading component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [BlockerLoading],
      providers: [
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideAnimations(),
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows after delay when withoutDelay is false', () => {
    const store = TestBed.inject(blockerLoadingStateToken);
    const fixture = TestBed.createComponent(BlockerLoading);
    fixture.detectChanges();

    store.setState('show', true);
    jest.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS - 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.blocker-loading')).toBeNull();

    jest.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.blocker-loading')).not.toBeNull();
  });

  it('shows immediately when withoutDelay is true and hides after turning off', () => {
    const store = TestBed.inject(blockerLoadingStateToken);
    const fixture = TestBed.createComponent(BlockerLoading);
    fixture.detectChanges();

    store.setState('withoutDelay', true);
    store.setState('show', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.blocker-loading')).not.toBeNull();

    store.setState('show', false);
    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS);
    fixture.detectChanges();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.blocker-loading')).toBeNull();
    expect(store.state.withoutDelay()).toBe(false);
  });

  it('cancels delayed show when toggled off before timeout', () => {
    const store = TestBed.inject(blockerLoadingStateToken);
    const fixture = TestBed.createComponent(BlockerLoading);
    fixture.detectChanges();

    store.setState('show', true);
    jest.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS - 10);

    store.setState('show', false);
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.blocker-loading')).toBeNull();
  });
});
