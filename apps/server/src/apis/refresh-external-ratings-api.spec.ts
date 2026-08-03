import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/logger', () => ({
  debugLog: vi.fn(),
  errorLog: vi.fn(),
}));

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  imdbId: string,
  hash = 'hash',
  usernameHash = 'user',
  imdbRate = '7.0',
  rottenTomatoesRate = '',
  metacriticRate = ''
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
       (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, `imdb:${imdbId}`, 'Title', 'title', '', '', '', hash);
  const itemId = Number(result.lastInsertRowid);
  const insertRating = db.prepare(
    'INSERT INTO collection_item_external_ratings (item_id, source, value) VALUES (?, ?, ?)'
  );
  for (const [source, value] of [
    ['imdb', imdbRate],
    ['rotten-tomatoes', rottenTomatoesRate],
    ['metacritic', metacriticRate],
  ]) {
    if (value) insertRating.run(itemId, source, value);
  }
};

const getRatings = (imdbId: string) =>
  getDatabase()
    .prepare(
      `SELECT ratings.source, ratings.value
       FROM collection_item_external_ratings AS ratings
       INNER JOIN collection_items ON collection_items.id = ratings.item_id
       WHERE collection_items.external_item_id = ?
       ORDER BY ratings.source`
    )
    .all(imdbId);

const insertShare = (ownerHash: string, sharedWithHash: string, canUpdate: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, 0, canUpdate ? 1 : 0, 0);
};

describe('refresh-external-ratings-api', () => {
  beforeEach(() => {
    process.env.OMDB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OMDB_API_KEY;
  });

  it('returns zero counts for an empty collection', async () => {
    insertUser();

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 0, checked: 0, fixed: 0, errors: 0 });
  });

  it('refreshes IMDb, Rotten Tomatoes, and Metacritic ratings', async () => {
    insertUser();
    insertItem('tt-1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-1',
          imdbRating: '8.4',
          Ratings: [
            { Source: 'Rotten Tomatoes', Value: '96%' },
            { Source: 'Metacritic', Value: '85/100' },
          ],
        }),
      }))
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 1, errors: 0 });
    expect(getRatings('tt-1')).toEqual([
      { source: 'imdb', value: '8.4' },
      { source: 'metacritic', value: '85/100' },
      { source: 'rotten-tomatoes', value: '96%' },
    ]);
  });

  it('does not update unchanged ratings', async () => {
    insertUser();
    insertItem('tt-1', 'hash', 'user', '8.4', '96%', '85/100');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-1',
          imdbRating: '8.4',
          Ratings: [
            { Source: 'Rotten Tomatoes', Value: '96%' },
            { Source: 'Metacritic', Value: '85/100' },
          ],
        }),
      }))
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 0 });
  });

  it('increments errors when OMDb API key is missing', async () => {
    insertUser();
    insertItem('tt-1');
    delete process.env.OMDB_API_KEY;

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
  });

  it('increments errors when OMDb has no item', async () => {
    insertUser();
    insertItem('tt-1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      }))
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
  });

  it('does not update ratings when the provider returns a different-cased item ID', async () => {
    insertUser();
    insertItem('tt-1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'TT-1',
          imdbRating: '9.9',
          Ratings: [{ Source: 'Rotten Tomatoes', Value: '100%' }],
        }),
      }))
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
    expect(getRatings('tt-1')).toEqual([{ source: 'imdb', value: '7.0' }]);
  });

  it('refreshes a shared library when the user has update permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('tt-own', 'own-hash', 'user');
    insertItem('tt-shared', 'shared-hash', 'owner');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-shared',
          imdbRating: '9.0',
          Ratings: [{ Source: 'Rotten Tomatoes', Value: '99%' }],
        }),
      }))
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 1, errors: 0 });
    expect(
      getDatabase()
        .prepare(
          `SELECT collection_items.username_hash, ratings.source, ratings.value
           FROM collection_items
           INNER JOIN collection_item_external_ratings AS ratings ON ratings.item_id = collection_items.id
           ORDER BY collection_items.username_hash, ratings.source`
        )
        .all()
    ).toEqual([
      { username_hash: 'owner', source: 'imdb', value: '9.0' },
      { username_hash: 'owner', source: 'rotten-tomatoes', value: '99%' },
      { username_hash: 'user', source: 'imdb', value: '7.0' },
    ]);
  });

  it('returns 404 when the shared library owner is not found', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('rejects shared ratings refresh without update permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', false);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-external-ratings-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(403);
  });
});
