import { copyToClipboard } from './copy-to-clipboard-util';
import { mobileUserAgent } from './mobile-user-agent.util';

jest.mock('./mobile-user-agent.util', () => ({
  mobileUserAgent: jest.fn(),
}));

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  let clipboardWrite: jest.Mock;

  beforeEach(() => {
    clipboardWrite = jest.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });

    document.querySelectorAll('textarea').forEach((element) => element.remove());
    (window as any).clipboardData = undefined;
    jest.clearAllMocks();
  });

  it('uses navigator.clipboard on desktop', async () => {
    (mobileUserAgent as jest.Mock).mockReturnValue(false);

    await copyToClipboard('hello');

    expect(clipboardWrite).toHaveBeenCalledWith('hello');
  });

  it('uses legacy clipboardData.setData when available on mobile', async () => {
    (mobileUserAgent as jest.Mock).mockReturnValue(true);
    (window as any).clipboardData = { setData: jest.fn() };

    await copyToClipboard('legacy');

    expect((window as any).clipboardData.setData).toHaveBeenCalledWith('Text', 'legacy');
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when supported', async () => {
    (mobileUserAgent as jest.Mock).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = jest.fn().mockReturnValue(true);
    document.execCommand = jest.fn().mockReturnValue(true);

    await copyToClipboard('command');

    expect(document.queryCommandSupported).toHaveBeenCalledWith('copy');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back to navigator.clipboard when execCommand throws', async () => {
    (mobileUserAgent as jest.Mock).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = jest.fn().mockReturnValue(true);
    document.execCommand = jest.fn().mockImplementation(() => {
      throw new Error('copy failed');
    });

    await copyToClipboard('fallback-exec-error');

    expect(clipboardWrite).toHaveBeenCalledWith('fallback-exec-error');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back to navigator.clipboard when no legacy APIs are available', async () => {
    (mobileUserAgent as jest.Mock).mockReturnValue(true);
    (window as any).clipboardData = undefined;
    document.queryCommandSupported = jest.fn().mockReturnValue(false);

    await copyToClipboard('fallback');

    expect(clipboardWrite).toHaveBeenCalledWith('fallback');
  });
});
