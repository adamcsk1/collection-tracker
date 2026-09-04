import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAvailableExternalMetadataProviders } from '../core/external-metadata/external-metadata-provider-factory';

const item = {
  providerItemId: 'tt0133093',
  externalIds: [{ source: 'imdb', id: 'tt0133093' }],
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: 'https://images.test/matrix.jpg',
  plot: 'plot',
  actors: 'actors',
  genres: ['Sci-Fi', 'Action'],
  ratings: [
    { source: 'Rotten Tomatoes', value: '83%' },
    { source: 'Internet Movie Database', value: '8.7' },
  ],
};

const bookItem = {
  providerItemId: '9780306406157',
  externalIds: [{ source: 'isbn', id: '9780306406157' }],
  title: 'The Book',
  year: '1965',
  contentType: 'book',
  poster: '',
  plot: '',
  actors: '',
  genres: [],
  ratings: [],
};

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });

describe('proxy-get-external-metadata-item-api', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, METADATA_SERVICE_URL: 'http://metadata.test/' };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('GET /external-metadata/items', () => {
    it('proxies item query to the metadata service and returns normalized result', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse(item));

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('http://metadata.test/v1/omdb/items/tt0133093');
      expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ provider: 'omdb', title: 'The Matrix' }));
    });

    it('returns 503 when no external metadata provider is configured', async () => {
      delete process.env.OMDB_API_KEY;
      const { setAvailableExternalMetadataProviders: setProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setProviders(['openlibrary', 'musicbrainz']);
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(503);
    });

    it('returns 400 when item id is missing', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: '' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    });

    it('returns 400 when provider is unsupported', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'tmdb', externalIdentityId: '603' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    });

    it('returns 404 when the configured provider has no matching item', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt0000000' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(404);
    });

    it('returns 502 when the configured provider item lookup fails', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('uses direct IMDb lookup for IMDb external identities', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'imdb', externalIdentityId: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse(item));

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('http://metadata.test/v1/omdb/items/by-imdb/tt0133093');
      expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ provider: 'omdb', title: 'The Matrix' }));
    });

    it('uses Open Library lookup for ISBN identities', async () => {
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'isbn', externalIdentityId: '0-306-40615-2' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse(bookItem));

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe(
        'http://metadata.test/v1/openlibrary/items/9780306406157'
      );
      expect(response.send).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openlibrary',
          providerItemId: '9780306406157',
          externalIds: [{ source: 'isbn', id: '9780306406157' }],
        })
      );
    });
  });
});
