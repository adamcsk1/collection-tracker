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
  rate = '7.0',
  rottenTomatoesRate = '',
  metacriticRate = ''
) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
       (username_hash, imdb_id, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, 'Title', 'title', '', rate, rottenTomatoesRate, metacriticRate, '', '', hash);
};

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
    expect(
      getDatabase()
        .prepare('SELECT rate, rotten_tomatoes_rate, metacritic_rate FROM collection_items WHERE imdb_id = ?')
        .get('tt-1')
    ).toEqual({ rate: '8.4', rotten_tomatoes_rate: '96%', metacritic_rate: '85/100' });
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
        .prepare('SELECT username_hash, rate, rotten_tomatoes_rate FROM collection_items ORDER BY username_hash')
        .all()
    ).toEqual([
      { username_hash: 'owner', rate: '9.0', rotten_tomatoes_rate: '99%' },
      { username_hash: 'user', rate: '7.0', rotten_tomatoes_rate: '' },
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
