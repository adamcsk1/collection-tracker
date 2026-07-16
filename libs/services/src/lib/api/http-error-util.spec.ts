import { describe, expect, it } from 'vitest';
import { isRateLimitError } from './http-error-util';

describe('http-error-util', () => {
  it('identifies rate limit errors', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it.each([undefined, null, new Error('failed'), { status: 401 }, { status: '429' }])(
    'rejects non-rate-limit error %s',
    (error) => {
      expect(isRateLimitError(error)).toBe(false);
    }
  );
});
