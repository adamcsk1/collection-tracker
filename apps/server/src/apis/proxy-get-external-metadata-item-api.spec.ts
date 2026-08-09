import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('proxy-get-external-metadata-item-api', () => {
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

  describe('GET /proxy/external-metadata/item', () => {
    it('proxies item query to the configured provider and returns normalized result', async () => {
      process.env.OMDB_API_KEY = 'test-key';
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt0133093' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            imdbID: 'tt0133093',
            imdbRating: '8.7',
            Ratings: [{ Source: 'Rotten Tomatoes', Value: '83%' }],
            Title: 'The Matrix',
            Year: '1999',
            Type: 'movie',
            Poster: 'poster',
            Plot: 'plot',
            Actors: 'actors',
            Genre: 'Sci-Fi, Action',
          }),
      } as any);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('i=tt0133093'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apikey=test-key'));
      expect(response.send).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'omdb',
          providerItemId: 'tt0133093',
          title: 'The Matrix',
          genres: ['Sci-Fi', 'Action'],
          ratings: expect.arrayContaining([
            { source: 'Rotten Tomatoes', value: '83%' },
            { source: 'Internet Movie Database', value: '8.7' },
          ]),
        })
      );
    });

    it('returns 503 when no external metadata provider is configured', async () => {
      delete process.env.OMDB_API_KEY;
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
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Response: 'False', Error: 'Movie not found!' }),
      } as any);

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
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as any);

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
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            imdbID: 'tt0133093',
            imdbRating: '8.7',
            Title: 'The Matrix',
            Year: '1999',
            Type: 'movie',
            Poster: 'poster',
            Plot: 'plot',
            Actors: 'actors',
            Genre: 'Sci-Fi, Action',
          }),
      } as any);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('i=tt0133093'));
      expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ provider: 'omdb', title: 'The Matrix' }));
    });

    it('uses Open Library lookup for ISBN identities', async () => {
      const response = mockResponse();
      const request: any = { query: { externalIdentitySource: 'isbn', externalIdentityId: '0-306-40615-2' } };
      const { app, handlerPromise } = buildApp(request, response);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ title: 'The Book', publish_date: '1965' }),
      } as any);

      const { register } = await import('./proxy-get-external-metadata-item-api');
      register(app);

      await handlerPromise();
      expect(fetch).toHaveBeenCalledWith(
        'https://openlibrary.org/isbn/9780306406157.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
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
