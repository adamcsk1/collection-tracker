import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { take } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpinnerLoading } from './spinner-loading';
import { initialSpinnerLoadingState, spinnerLoadingStateToken } from './spinner-loading-store';

describe('SpinnerLoading component', () => {
  let fixture: ComponentFixture<SpinnerLoading>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SpinnerLoading],
      providers: [
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    fixture = TestBed.createComponent(SpinnerLoading);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits true when show is set and false after delay when cleared', async () => {
    const store = TestBed.inject(spinnerLoadingStateToken);
    let lastEmission: boolean | null = null;

    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));

    store.setState('show', true);
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    expect(lastEmission).toBe(true);

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    vi.advanceTimersByTime(250);
    expect(lastEmission).toBe(false);
  });

  it('waits to hide until all show increments are cleared', async () => {
    const store = TestBed.inject(spinnerLoadingStateToken);
    let lastEmission: boolean | null = null;

    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));

    store.setState('show', true);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    store.setState('show', true);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    expect(lastEmission).toBe(true);

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    vi.advanceTimersByTime(250);

    expect(lastEmission).toBe(false);
  });
});
