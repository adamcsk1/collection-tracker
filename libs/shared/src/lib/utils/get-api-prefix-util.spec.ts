import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getApiPrefix', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((base) => base.remove());
    vi.resetModules();
  });

  const setBaseHref = (href: string): void => {
    const base = document.createElement('base');
    base.setAttribute('href', href);
    document.head.append(base);
  };

  it('returns the API prefix with the deployment base path', async () => {
    const { getApiPrefix } = await import('./get-api-prefix-util');
    setBaseHref('/collection-tracker/client/');

    expect(getApiPrefix()).toBe('/collection-tracker/api/v1');
  });
});
