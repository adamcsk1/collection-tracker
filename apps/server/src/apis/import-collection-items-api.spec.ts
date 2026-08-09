import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

describe('import-collection-items-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when the source is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./import-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('counts IMDb IDs as errors when the default provider is unavailable', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000001' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./import-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
  });

  it('skips IMDb IDs that already exist by canonical identity in a non-library list', async () => {
    insertUser('user');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        'tt0000001',
        'imdb:tt0000001',
        'up-next',
        'Existing Movie',
        'existing movie',
        '2024',
        'Plot',
        'poster.jpg',
        'hash'
      );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000001' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./import-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 1, errorCount: 0 });
  });

  it('imports a fetched IMDb item into the library', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            imdbID: 'tt0000001',
            Type: 'movie',
            Title: 'Fetched Movie',
            Year: '2024',
            imdbRating: '7.1',
            Plot: 'Plot',
            Poster: 'poster.jpg',
            Actors: 'Actor',
            Genre: 'Drama',
            Ratings: [],
          }),
      })
    );
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000001' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./import-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 1, skippedCount: 0, errorCount: 0 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt0000001')
    ).toEqual({ title: 'Fetched Movie' });
  });
});
