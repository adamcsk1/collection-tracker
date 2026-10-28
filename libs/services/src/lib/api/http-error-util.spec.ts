import { describe, expect, it } from 'vitest';
import { isTransientHttpError } from './http-error-util';

describe('http-error-util', () => {
  it.each([0, 429, 500, 502, 503, 504, 599])('identifies transient HTTP status %s', (status) => {
    expect(isTransientHttpError({ status })).toBe(true);
  });

  it.each([
    undefined,
    null,
    new Error('failed'),
    { status: 401 },
    { status: 403 },
    { status: 400 },
    { status: 600 },
    { status: '429' },
  ])('rejects non-transient error %s', (error) => {
    expect(isTransientHttpError(error)).toBe(false);
  });
});
