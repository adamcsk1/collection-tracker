import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('proxy-external-metadata-search-api', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('GET /proxy/external-metadata/search', () => {
    it('proxies search query to the configured provider and returns normalized results', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Search: [{ imdbID: 'tt0133093', Title: 'The Matrix', Type: 'movie' }] }),
      } as any);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('s=Matrix'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apikey=test-key'));
      expect(response.send).toHaveBeenCalledWith({
        results: [
          expect.objectContaining({
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            contentType: 'movie',
          }),
        ],
      });
    });

    it('returns 503 when no external metadata provider is configured', async () => {
      delete process.env.OMDB_API_KEY;
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(503);
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

    it('returns 502 when the configured provider search fails', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as any);

      const { register } = await import('./proxy-external-metadata-search-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });
  });
});
