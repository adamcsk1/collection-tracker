import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExternalMetadataProviderByName, getExternalMetadataProviders } from './external-metadata-provider-factory';
import { DEFAULT_OMDB_API_URL } from '../providers/omdb-const';
import { DEFAULT_OPENLIBRARY_API_URL } from '../providers/openlibrary-const';

const getExternalMetadataConfig = vi.hoisted(() => vi.fn(() => ({})));
vi.mock('./external-metadata-config', () => ({ getExternalMetadataConfig }));

describe('external-metadata-provider-factory', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    getExternalMetadataConfig.mockReturnValue({});
    vi.unstubAllGlobals();
  });

  it('returns the OMDb provider when OMDB_API_KEY is set', () => {
    process.env = { ...originalEnv, OMDB_API_KEY: 'key' };

    expect(getExternalMetadataProviderByName('omdb')?.name).toBe('omdb');
  });

  it('always returns the public Open Library provider', () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;

    expect(getExternalMetadataProviders().map((provider) => provider.name)).toEqual(['openlibrary', 'musicbrainz']);
  });

  it('uses the default Open Library URL when OPENLIBRARY_API_URL is missing', async () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;
    delete process.env.OPENLIBRARY_API_URL;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [] }) } as Response));

    await getExternalMetadataProviderByName('openlibrary')?.search('query');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    const expectedUrl = new URL(DEFAULT_OPENLIBRARY_API_URL);
    expect(requestUrl.origin).toBe(expectedUrl.origin);
    expect(requestUrl.pathname).toBe(`${expectedUrl.pathname.replace(/\/$/, '')}/search.json`);
  });

  it('uses a trimmed Open Library URL override', async () => {
    process.env = { ...originalEnv, OPENLIBRARY_API_URL: '  https://books.example/api/  ' };
    delete process.env.OMDB_API_KEY;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [] }) } as Response));

    await getExternalMetadataProviderByName('openlibrary')?.search('query');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(requestUrl.origin).toBe('https://books.example');
    expect(requestUrl.pathname).toBe('/api/search.json');
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

  it('uses the default OMDb URL when OMDB_API_URL is missing', async () => {
    process.env = { ...originalEnv, OMDB_API_KEY: 'key' };
    delete process.env.OMDB_API_URL;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response));

    await getExternalMetadataProviderByName('omdb')?.search('query');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    const defaultUrl = new URL(DEFAULT_OMDB_API_URL);
    expect(requestUrl.origin).toBe(defaultUrl.origin);
    expect(requestUrl.pathname).toBe(defaultUrl.pathname);
  });

  it('uses a normalized replacement without requiring the built-in provider credentials', async () => {
    process.env = { ...originalEnv };
    delete process.env.OMDB_API_KEY;
    getExternalMetadataConfig.mockReturnValue({ omdb: { baseUrl: 'https://metadata.test/v1/' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { results: [] } }), {
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    const provider = getExternalMetadataProviderByName('omdb');
    await provider?.search('query');

    expect(provider?.supportsDirectImdbId).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('https://metadata.test/v1/search?s=query');
  });
});
