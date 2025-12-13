import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './copy-to-clipboard-util';
import { mobileUserAgent } from './mobile-user-agent.util';

vi.mock('./mobile-user-agent.util', () => ({
  mobileUserAgent: vi.fn(),
}));

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  let clipboardWrite: ReturnType<typeof vi.fn>;
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clipboardWrite = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

    appendSpy = vi.spyOn(document.body, 'appendChild');
    removeSpy = vi.spyOn(document.body, 'removeChild');
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    (window as any).clipboardData = undefined;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('uses navigator.clipboard on desktop', async () => {
    (mobileUserAgent as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await copyToClipboard('hello');

    expect(clipboardWrite).toHaveBeenCalledWith('hello');
  });

  it('uses legacy clipboardData.setData when available on mobile', async () => {
    (mobileUserAgent as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (window as any).clipboardData = { setData: vi.fn() };

    await copyToClipboard('legacy');

    expect((window as any).clipboardData.setData).toHaveBeenCalledWith('Text', 'legacy');
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when supported', async () => {
    (mobileUserAgent as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = vi.fn().mockReturnValue(true);
    document.execCommand = vi.fn().mockReturnValue(true);

    await copyToClipboard('command');

    expect(document.queryCommandSupported).toHaveBeenCalledWith('copy');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('falls back to navigator.clipboard when execCommand throws', async () => {
    (mobileUserAgent as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = vi.fn().mockReturnValue(true);
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('copy failed');
    });

    await copyToClipboard('fallback-exec-error');

    expect(clipboardWrite).toHaveBeenCalledWith('fallback-exec-error');
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('falls back to navigator.clipboard when no legacy APIs are available', async () => {
    (mobileUserAgent as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = vi.fn().mockReturnValue(false);

    await copyToClipboard('fallback');

    expect(clipboardWrite).toHaveBeenCalledWith('fallback');
  });
});
