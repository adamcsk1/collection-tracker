import { afterEach, describe, expect, it, vi } from 'vitest';

describe('redirectToLogin', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((base) => base.remove());
    vi.resetModules();
  });

  it('does not throw when navigation is triggered', async () => {
    // jsdom does not support actual navigation but does not throw either;
    // the function's try/catch ensures callers are never affected by any
    // environment-level restriction on window.location.assign.
    const { redirectToLogin } = await import('./redirect-to-login-util');
    expect(() => redirectToLogin()).not.toThrow();
  });

  it('prepends the deployment base path to the login URL', async () => {
    const { getLoginUrl } = await import('./redirect-to-login-util');
    const base = document.createElement('base');
    base.setAttribute('href', '/collection-tracker/client/');
    document.head.append(base);
    expect(getLoginUrl()).toBe('/collection-tracker/login/');
  });
});
