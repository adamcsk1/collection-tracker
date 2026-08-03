import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDirectImdbExternalMetadataProvider,
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from './external-metadata-provider-factory';
import { DEFAULT_OMDB_API_URL } from './providers/omdb-const';
import { DEFAULT_OPENLIBRARY_API_URL } from './providers/openlibrary-const';

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

  it('always returns the public Open Library provider', () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;

    expect(getExternalMetadataProviders().map((provider) => provider.name)).toEqual(['openlibrary']);
    expect(getDirectImdbExternalMetadataProvider()).toBeNull();
  });

  it.each([undefined, '', '   ', '  https://books.example/api/  ', '  https://books.example/api  '])(
    'uses the configured Open Library URL or its default when OPENLIBRARY_API_URL is %s',
    async (openLibraryApiUrl) => {
      process.env = { ...originalEnv };
      delete process.env.OMDB_API_KEY;
      if (openLibraryApiUrl === undefined) delete process.env.OPENLIBRARY_API_URL;
      else process.env.OPENLIBRARY_API_URL = openLibraryApiUrl;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [] }) } as Response));

      await getExternalMetadataProviderByName('openlibrary')?.search('query');

      const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
      const expectedUrl = new URL(openLibraryApiUrl?.trim() || DEFAULT_OPENLIBRARY_API_URL);
      expect(requestUrl.origin).toBe(expectedUrl.origin);
      expect(requestUrl.pathname).toBe(`${expectedUrl.pathname.replace(/\/$/, '')}/search.json`);
    }
  );

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
