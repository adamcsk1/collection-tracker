import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('proxy-omdb-search-api', () => {
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

  describe('GET /proxy/omdb/search', () => {
    it('proxies search query to OMDb and returns result', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      const omdbData = { Search: [{ imdbID: 'tt0133093', Title: 'The Matrix' }] };
      vi.mocked(fetch).mockResolvedValue({ json: () => Promise.resolve(omdbData) } as any);

      const { register } = await import('./proxy-omdb-search-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('s=Matrix'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apikey=test-key'));
      expect(response.send).toHaveBeenCalledWith(omdbData);
    });

    it('returns 503 when OMDB_API_KEY is not set', async () => {
      delete process.env.OMDB_API_KEY;
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-omdb-search-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(503);
    });

    it('returns 500 on fetch error', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { s: 'Matrix' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockRejectedValue(new Error('network error'));

      const { register } = await import('./proxy-omdb-search-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(500);
    });
  });
});
