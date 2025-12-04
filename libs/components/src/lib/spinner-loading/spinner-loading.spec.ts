import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { take } from 'rxjs';
import { SpinnerLoading } from './spinner-loading';
import { initialSpinnerLoadingState, spinnerLoadingStateToken } from './spinner-loading-store';

describe('SpinnerLoading component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SpinnerLoading],
      providers: [
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits true when show is set and false after delay when cleared', async () => {
    const store = TestBed.inject(spinnerLoadingStateToken);
    const fixture = TestBed.createComponent(SpinnerLoading);
    let lastEmission: boolean | null = null;

    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    fixture.detectChanges();

    store.setState('show', true);
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    expect(lastEmission).toBe(true);

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    jest.advanceTimersByTime(250);
    expect(lastEmission).toBe(false);
  });

  it('waits to hide until all show increments are cleared', async () => {
    const store = TestBed.inject(spinnerLoadingStateToken);
    const fixture = TestBed.createComponent(SpinnerLoading);
    let lastEmission: boolean | null = null;

    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));

    fixture.detectChanges();

    store.setState('show', true);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    store.setState('show', true);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    jest.runOnlyPendingTimers();

    expect(lastEmission).toBe(true);

    store.setState('show', false);
    fixture.componentInstance['spinnerLoading$'].pipe(take(1)).subscribe((value: boolean) => (lastEmission = value));
    await Promise.resolve();
    jest.advanceTimersByTime(250);

    expect(lastEmission).toBe(false);
  });
});
