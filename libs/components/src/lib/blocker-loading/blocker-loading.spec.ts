import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@services/theme/theme-service';
import { initialThemeState, themeStateToken } from '@services/theme/theme-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockerLoading } from './blocker-loading';
import { BLOCKER_LOADING_TIMEOUT_MS } from './blocker-loading-const';
import { blockerLoadingStateToken, initialBlockerLoadingState } from './blocker-loading-store';

describe('BlockerLoading component', () => {
  let fixture: ComponentFixture<BlockerLoading>;
  let component: BlockerLoading;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [BlockerLoading],
      providers: [
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialThemeState, themeStateToken),
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    fixture = TestBed.createComponent(BlockerLoading);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows after delay when withoutDelay is false', () => {
    const store = TestBed.inject(blockerLoadingStateToken);

    store.setState('show', true);
    vi.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS - 1);
    fixture.detectChanges();
    expect(component['showBlockerLoading']()).toBe(false);

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(component['showBlockerLoading']()).toBe(true);
  });

  it('shows immediately when withoutDelay is true and hides after turning off', () => {
    const store = TestBed.inject(blockerLoadingStateToken);

    store.setState('withoutDelay', true);
    store.setState('show', true);
    fixture.detectChanges();

    expect(component['showBlockerLoading']()).toBe(true);

    store.setState('show', false);
    vi.runOnlyPendingTimers();
    vi.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS);
    fixture.detectChanges();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(component['showBlockerLoading']()).toBe(false);
    expect(store.state.withoutDelay()).toBe(false);
  });

  it('cancels delayed show when toggled off before timeout', () => {
    const store = TestBed.inject(blockerLoadingStateToken);

    store.setState('show', true);
    vi.advanceTimersByTime(BLOCKER_LOADING_TIMEOUT_MS - 10);

    store.setState('show', false);
    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(component['showBlockerLoading']()).toBe(false);
  });
});
