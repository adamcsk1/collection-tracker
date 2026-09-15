import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/logger', () => ({ errorLog: vi.fn(), debugLog: vi.fn(), infoLog: vi.fn(), warningLog: vi.fn() }));

const item = {
  providerItemId: 'tt0133093',
  externalIds: [{ source: 'imdb', id: 'tt0133093' }],
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: 'https://images.test/matrix.jpg',
  plot: 'plot',
  actors: 'actors',
  genres: ['Action'],
  ratings: [{ source: 'IMDb', value: '8.7' }],
};

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });

describe('proxy-external-metadata-search-api', () => {
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

  describe('GET /external-metadata/search', () => {
    it('proxies search query to the metadata service and returns normalized results', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [item] }));

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url.toString().includes('/v1/omdb/search?s=Matrix'))).toBe(
        true
      );
      expect(response.send).toHaveBeenCalledWith({
        results: [expect.objectContaining({ provider: 'omdb', providerItemId: 'tt0133093', title: 'The Matrix' })],
      });
    });

    it('uses public Open Library when no credentialed provider is configured', async () => {
      delete process.env.OMDB_API_KEY;
      const { setAvailableExternalMetadataProviders: setProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setProviders(['openlibrary', 'musicbrainz']);
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [] }));

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0].toString());
      expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('http://metadata.test/v1/openlibrary/search');
      expect(requestUrl.searchParams.get('s')).toBe('Matrix');
      expect(response.send).toHaveBeenCalledWith({ results: [] });
    });

    it('returns 400 when search text is missing', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: '' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    });

    it('returns 400 when provider is unsupported', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix', provider: 'tmdb' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    });

    it('returns 400 when provider is direct IMDb lookup only', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix', provider: 'imdb' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    });

    it('searches a known configured provider when provider is supplied', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix', provider: 'omdb' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [item] }));

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({
        results: [expect.objectContaining({ provider: 'omdb', providerItemId: 'tt0133093' })],
      });
    });

    it('returns 503 when a known provider is requested but not configured', async () => {
      delete process.env.OMDB_API_KEY;
      const { setAvailableExternalMetadataProviders: setProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setProviders(['openlibrary', 'musicbrainz']);
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix', provider: 'omdb' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(503);
    });

    it('returns 502 when the configured provider search fails', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('logs a selected provider failure with request context and keeps the 502 response', async () => {
      const { errorLog } = await import('../core/logger');
      const { setAvailableExternalMetadataProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setAvailableExternalMetadataProviders(['omdb']);
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(
        { id: 'search-1', query: { s: 'private-title', provider: 'omdb' } },
        response
      );
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);
      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
      expect(errorLog).toHaveBeenCalledOnce();
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('"requestId":"search-1","provider":"omdb"'));
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('omdb replacement responded with 500'));
      expect(JSON.stringify(vi.mocked(errorLog).mock.calls)).not.toContain('private-title');
    });

    it('logs individual failures while returning successful multi-provider results', async () => {
      const { errorLog } = await import('../core/logger');
      const { setAvailableExternalMetadataProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setAvailableExternalMetadataProviders(['omdb', 'openlibrary']);
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ id: 'search-2', query: { s: 'title' } }, response);
      vi.mocked(fetch).mockImplementation(async (url) =>
        url.toString().includes('/omdb/') ? new Response(null, { status: 503 }) : jsonResponse({ results: [] })
      );
      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);
      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ results: [] });
      expect(response.code).not.toHaveBeenCalledWith(502);
      expect(errorLog).toHaveBeenCalledOnce();
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('omdb replacement responded with 503'));
    });

    it('returns search results when posters are missing', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const { setAvailableExternalMetadataProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setAvailableExternalMetadataProviders(['omdb']);
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ query: { s: 'Matrix', provider: 'omdb' } }, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [{ ...item, poster: '' }] }));
      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);
      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({
        results: [expect.objectContaining({ providerItemId: 'tt0133093', poster: '' })],
      });
    });

    it('logs normalized response validation failures', async () => {
      const { errorLog } = await import('../core/logger');
      const { setAvailableExternalMetadataProviders } =
        await import('../core/external-metadata/external-metadata-provider-factory');
      setAvailableExternalMetadataProviders(['omdb']);
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ id: 'search-3', query: { s: 'title', provider: 'omdb' } }, response);
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [{ ...item, poster: 'N/A' }] }));
      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);
      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('invalid poster'));
    });
  });
});
