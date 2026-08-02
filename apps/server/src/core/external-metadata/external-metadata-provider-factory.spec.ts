import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDirectImdbExternalMetadataProvider,
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from './external-metadata-provider-factory';
import { DEFAULT_OMDB_API_URL } from './providers/omdb-const';

describe('external-metadata-provider-factory', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('returns the OMDb provider when OMDB_API_KEY is set', () => {
    process.env = { ...originalEnv, OMDB_API_KEY: 'key' };

    expect(getExternalMetadataProviderByName('omdb')?.name).toBe('omdb');
    expect(getDirectImdbExternalMetadataProvider()?.name).toBe('omdb');
  });

  it('returns an empty provider list when no provider is configured', () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;

    expect(getExternalMetadataProviders()).toEqual([]);
    expect(getDirectImdbExternalMetadataProvider()).toBeNull();
  });

  it('uses the trimmed OMDB_API_URL override', async () => {
    process.env = {
      ...originalEnv,
      OMDB_API_KEY: 'key',
      OMDB_API_URL: '  https://metadata.example.com/omdb/  ',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response));

    await getExternalMetadataProviderByName('omdb')?.search('query');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://metadata.example.com/omdb/');
  });

  it.each([undefined, '', '   '])('uses the default OMDb URL when OMDB_API_URL is %s', async (omdbApiUrl) => {
    process.env = { ...originalEnv, OMDB_API_KEY: 'key' };
    if (omdbApiUrl === undefined) {
      delete process.env.OMDB_API_URL;
    } else {
      process.env.OMDB_API_URL = omdbApiUrl;
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response));

    await getExternalMetadataProviderByName('omdb')?.search('query');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    const defaultUrl = new URL(DEFAULT_OMDB_API_URL);
    expect(requestUrl.origin).toBe(defaultUrl.origin);
    expect(requestUrl.pathname).toBe(defaultUrl.pathname);
  });
});
