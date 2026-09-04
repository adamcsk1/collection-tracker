import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDirectImdbExternalMetadataProvider,
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
  getMetadataServiceUrl,
  loadExternalMetadataProviders,
  resetExternalMetadataProviderCache,
  setAvailableExternalMetadataProviders,
} from './external-metadata-provider-factory';

vi.mock('../argv/argv', () => ({ getArgv: () => ({ dataFolder: '.data', debug: false, metadataServiceUrl: '' }) }));

describe('external-metadata-provider-factory', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    resetExternalMetadataProviderCache();
    vi.unstubAllGlobals();
  });

  it('builds HTTP clients for the metadata service', () => {
    process.env = { ...originalEnv, METADATA_SERVICE_URL: 'http://metadata.test/' };

    expect(getMetadataServiceUrl()).toBe('http://metadata.test/');
    expect(getExternalMetadataProviderByName('omdb')?.name).toBe('omdb');
    expect(getDirectImdbExternalMetadataProvider()?.name).toBe('omdb');
  });

  it('omits OMDb until the metadata service lists it', () => {
    process.env = { ...originalEnv, METADATA_SERVICE_URL: 'http://metadata.test/' };
    setAvailableExternalMetadataProviders(['openlibrary', 'musicbrainz']);

    expect(getExternalMetadataProviders().map((provider) => provider.name)).toEqual(['openlibrary', 'musicbrainz']);
    expect(getDirectImdbExternalMetadataProvider()).toBeNull();
  });

  it('searches through the metadata service contract', async () => {
    process.env = { ...originalEnv, METADATA_SERVICE_URL: 'http://metadata.test/' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { results: [] } }), {
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await getExternalMetadataProviderByName('omdb')?.search('query');

    expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('http://metadata.test/v1/omdb/search?s=query');
  });

  it('loads available providers from the metadata service', async () => {
    process.env = { ...originalEnv, METADATA_SERVICE_URL: 'http://metadata.test/' };
    delete process.env.OMDB_API_KEY;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              providers: [
                { name: 'omdb', supportsDirectImdbId: true, supportsSeasonMetadata: true },
                { name: 'openlibrary', supportsDirectImdbId: false, supportsSeasonMetadata: false },
              ],
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await loadExternalMetadataProviders();

    expect(getExternalMetadataProviders().map((provider) => provider.name)).toEqual(['omdb', 'openlibrary']);
  });
});
