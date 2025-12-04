import { mobileUserAgent } from './mobile-user-agent.util';

describe('mobileUserAgent', () => {
  const originalUA = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  it('returns truthy for mobile user agents', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Android)', configurable: true });
    expect(!!mobileUserAgent()).toBe(true);
  });

  it('returns falsy for non-mobile user agents', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT)', configurable: true });
    expect(!!mobileUserAgent()).toBe(false);
  });
});
