import { describe, expect, it } from 'vitest';
import { redirectToLogin } from './main-util';

describe('redirectToLogin', () => {
  it('does not throw when navigation is triggered', () => {
    // jsdom does not support actual navigation but does not throw either;
    // the function's try/catch ensures callers are never affected by any
    // environment-level restriction on window.location.assign.
    expect(() => redirectToLogin()).not.toThrow();
  });
});
