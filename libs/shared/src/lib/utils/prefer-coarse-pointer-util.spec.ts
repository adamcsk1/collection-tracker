import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoarsePointerBasedDebounceTime } from './prefer-coarse-pointer-util';

describe('prefer-coarse-pointer util', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('returns extended debounce when a coarse pointer is detected', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      writable: true,
      configurable: true,
    });

    expect(getCoarsePointerBasedDebounceTime()).toBe(700);
  });

  it('returns standard debounce when pointer is fine', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      writable: true,
      configurable: true,
    });

    expect(getCoarsePointerBasedDebounceTime()).toBe(500);
  });

  it('returns standard debounce when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getCoarsePointerBasedDebounceTime()).toBe(500);
  });
});
