import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoarsePointerBasedDebounceTime, prefersCoarsePointer } from './prefer-coarse-pointer-util';

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

  it('detects coarse pointer and returns extended debounce', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });

    expect(prefersCoarsePointer()).toBe(true);
    expect(getCoarsePointerBasedDebounceTime()).toBe(700);
  });

  it('returns defaults when pointer is fine or matchMedia is missing', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });

    expect(prefersCoarsePointer()).toBe(false);
    expect(getCoarsePointerBasedDebounceTime()).toBe(500);

    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(prefersCoarsePointer()).toBe(false);
    expect(getCoarsePointerBasedDebounceTime()).toBe(500);
  });
});
