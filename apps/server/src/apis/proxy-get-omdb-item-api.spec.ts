import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('proxy-get-omdb-item-api', () => {
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

  describe('GET /proxy/omdb/item', () => {
    it('proxies item query to OMDb and returns result', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { i: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      const omdbData = { imdbID: 'tt0133093', Title: 'The Matrix' };
      vi.mocked(fetch).mockResolvedValue({ json: () => Promise.resolve(omdbData) } as any);

      const { register } = await import('./proxy-get-omdb-item-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('i=tt0133093'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apikey=test-key'));
      expect(response.send).toHaveBeenCalledWith(omdbData);
    });

    it('returns 503 when OMDB_API_KEY is not set', async () => {
      delete process.env.OMDB_API_KEY;
      const response = mockResponse();
      const request: any = { query: { i: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./proxy-get-omdb-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(503);
    });

    it('returns 500 on fetch error', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { i: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockRejectedValue(new Error('network error'));

      const { register } = await import('./proxy-get-omdb-item-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(500);
    });
  });
});
