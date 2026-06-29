import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('proxy-external-metadata-providers-api', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('GET /proxy/external-metadata/providers', () => {
    it('returns configured external metadata providers', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({}, response);

      const { register } = await import('./proxy-external-metadata-providers-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({
        providers: [{ name: 'omdb', supportsSeasonMetadata: true, supportsDirectImdbId: true }],
      });
    });

    it('returns an empty list when no external metadata providers are configured', async () => {
      delete process.env.OMDB_API_KEY;
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({}, response);

      const { register } = await import('./proxy-external-metadata-providers-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ providers: [] });
    });
  });
});
