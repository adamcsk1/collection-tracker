import { afterEach, describe, expect, it, vi } from 'vitest';

describe('redirectToLogin', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((base) => base.remove());
    vi.resetModules();
  });

  it('prepends the deployment base path to the login URL', async () => {
    const { getLoginUrl } = await import('./redirect-to-login-util');
    const base = document.createElement('base');
    base.setAttribute('href', '/collection-tracker/client/');
    document.head.append(base);
    expect(getLoginUrl()).toBe('/collection-tracker/login/');
  });
});
