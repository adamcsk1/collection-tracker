import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getBasePath', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((base) => base.remove());
    vi.resetModules();
  });

  const setBaseHref = (href: string): void => {
    const base = document.createElement('base');
    base.setAttribute('href', href);
    document.head.append(base);
  };

  it('returns an empty base path when no base element exists', async () => {
    const { getBasePath } = await import('./get-base-path-util');
    expect(getBasePath()).toBe('');
  });

  it('returns an empty base path for the root base href', async () => {
    const { getBasePath } = await import('./get-base-path-util');
    setBaseHref('/');

    expect(getBasePath()).toBe('');
  });

  it('removes a trailing app segment from the base href', async () => {
    const { getBasePath } = await import('./get-base-path-util');
    setBaseHref('/collection-tracker/client/');

    expect(getBasePath()).toBe('/collection-tracker');
  });

  it('returns the base href when it does not end with an app segment', async () => {
    const { getBasePath } = await import('./get-base-path-util');
    setBaseHref('/collection-tracker/');

    expect(getBasePath()).toBe('/collection-tracker');
  });

  it('caches the computed base path and avoids re-querying the DOM', async () => {
    const { getBasePath } = await import('./get-base-path-util');
    setBaseHref('/cached-app/client/');

    const firstResult = getBasePath();
    expect(firstResult).toBe('/cached-app');

    document.querySelectorAll('base').forEach((base) => base.remove());

    const secondResult = getBasePath();
    expect(secondResult).toBe('/cached-app');
  });
});
