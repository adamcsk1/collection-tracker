import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const item = {
  image: 'poster.jpg',
  title: 'Custom File',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  externalProvider: 'omdb',
  externalItemId: 'tt0000001',
  tags: [],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One, Actor Two',
  plot: 'Plot',
  contentType: 'movie',
  favorite: false,
};

describe('create-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses only the global authenticated API rate limit', async () => {
    const response = mockResponse();
    const request: any = { body: {}, usernameHash: 'user' };
    const { app } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(
      `${API_PREFIX}/collection-items`,
      expect.not.objectContaining({ config: expect.anything() }),
      expect.any(Function)
    );
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('creates a DB item and returns it', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ title: 'Custom File' }) });
    expect(
      getDatabase()
        .prepare(
          `SELECT collection_items.title,
             (SELECT value FROM collection_item_external_ratings WHERE item_id = collection_items.id AND source = 'rotten-tomatoes') AS rotten_tomatoes_rate,
             (SELECT value FROM collection_item_external_ratings WHERE item_id = collection_items.id AND source = 'metacritic') AS metacritic_rate
           FROM collection_items WHERE external_item_id = ?`
        )
        .get('tt0000001')
    ).toEqual({
      title: 'Custom File',
      rotten_tomatoes_rate: '96%',
      metacritic_rate: '85/100',
    });
  });

  it('stores canonical identity mappings from external IDs', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = {
      body: {
        ...item,
        externalProvider: 'omdb',
        externalItemId: '603',
        IMDbId: undefined,
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare(
          'SELECT external_provider, external_item_id, canonical_item_id FROM collection_items WHERE external_provider = ?'
        )
        .get('omdb')
    ).toEqual({ external_provider: 'omdb', external_item_id: '603', canonical_item_id: 'imdb:tt0133093' });
    expect(
      getDatabase()
        .prepare(
          'SELECT external_provider, external_item_id, canonical_item_id FROM external_item_identities WHERE username_hash = ? AND canonical_item_id = ? ORDER BY external_provider, external_item_id'
        )
        .all('user', 'imdb:tt0133093')
    ).toEqual([
      { external_provider: 'imdb', external_item_id: 'tt0133093', canonical_item_id: 'imdb:tt0133093' },
      { external_provider: 'omdb', external_item_id: '603', canonical_item_id: 'imdb:tt0133093' },
    ]);
  });

  it('returns 409 when external IDs match an existing canonical item', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        'tt0133093',
        'imdb:tt0133093',
        'The Matrix',
        'the matrix',
        '1999',
        'Plot',
        'img.jpg',
        'hash'
      );
    const response = mockResponse();
    const request: any = {
      body: {
        ...item,
        externalProvider: 'omdb',
        externalItemId: '603',
        IMDbId: undefined,
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('prefers submitted IMDb identity over an existing provider primary mapping', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        'tt0133093',
        'imdb:tt0133093',
        'The Matrix',
        'the matrix',
        '1999',
        'Plot',
        'img.jpg',
        'hash'
      );
    getDatabase()
      .prepare(
        `INSERT OR REPLACE INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('user', 'omdb:603', 'omdb', '603', 'primary');
    const response = mockResponse();
    const request: any = {
      body: {
        ...item,
        externalProvider: 'omdb',
        externalItemId: '603',
        IMDbId: undefined,
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('upgrades existing canonical rows when adding stronger provider identity evidence', async () => {
    insertUser('fallback-user');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'fallback-user',
        'omdb',
        '603',
        'omdb:603',
        'up-next',
        'Provider Movie',
        'provider movie',
        '1999',
        'Plot',
        'img.jpg',
        'old-hash'
      );
    getDatabase()
      .prepare(
        `INSERT OR REPLACE INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('fallback-user', 'omdb:603', 'omdb', '603', 'primary');
    const response = mockResponse();
    const request: any = {
      body: {
        ...item,
        externalProvider: 'omdb',
        externalItemId: '603',
        IMDbId: undefined,
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
      },
      usernameHash: 'fallback-user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ canonicalItemId: 'imdb:tt0133093' }),
    });
    expect(
      getDatabase()
        .prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
        .get('fallback-user', 'up-next')
    ).toEqual({ canonical_item_id: 'imdb:tt0133093' });
    expect(
      getDatabase()
        .prepare(
          'SELECT canonical_item_id FROM external_item_identities WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?'
        )
        .get('fallback-user', 'imdb', 'tt0133093')
    ).toEqual({ canonical_item_id: 'imdb:tt0133093' });
  });

  it('returns 409 instead of inserting when provider evidence resolves to a same-list primary item', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        '603',
        'omdb:603',
        'Provider Movie',
        'provider movie',
        '1999',
        'Plot',
        'img.jpg',
        'old-hash'
      );
    getDatabase()
      .prepare(
        `INSERT OR REPLACE INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('user', 'omdb:603', 'omdb', '603', 'primary');
    const response = mockResponse();
    const request: any = {
      body: {
        ...item,
        externalProvider: 'omdb',
        externalItemId: '603',
        IMDbId: undefined,
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(409);
    expect(
      getDatabase().prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ?').get('user')
    ).toEqual({ count: 1 });
  });

  it('creates a watch later item using listType', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'up-next' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Custom File', listType: 'up-next', contentType: 'movie', tags: [] }),
    });
    expect(
      getDatabase().prepare('SELECT list_type FROM collection_items WHERE external_item_id = ?').get('tt0000001')
    ).toEqual({ list_type: 'up-next' });
  });

  it('creates a wishlist item using listType', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'wishlist' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Custom File', listType: 'wishlist', contentType: 'movie', tags: [] }),
    });
  });

  it('creates a tracking item using listType', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, contentType: 'series', listType: 'tracking' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Custom File',
        listType: 'tracking',
        contentType: 'series',
        tags: [],
      }),
    });
  });

  it('stores fetched series metadata when requested', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}, {}] }) })
    );
    insertUser();
    const response = mockResponse();
    const request: any = {
      body: { ...item, contentType: 'series', listType: 'tracking' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracking_seasons.season, series_tracking_seasons.episodes
           FROM series_tracking_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracking_seasons.item_id
           WHERE collection_items.external_item_id = ?`
        )
        .all('tt0000001')
    ).toEqual([{ season: 1, episodes: 3 }]);
  });

  it('still creates a tracking item when metadata fetch fails', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('OMDb unavailable')));
    insertUser();
    const response = mockResponse();
    const request: any = {
      body: { ...item, contentType: 'series', listType: 'tracking' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Custom File',
        listType: 'tracking',
        contentType: 'series',
        tags: [],
      }),
    });
  });

  it('creates a tracking item with a movie type', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'tracking' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        listType: 'tracking',
      }),
    });
  });

  it('marks a tracking book completed when created with full page progress', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = {
      body: {
        image: '',
        title: 'Finished Book',
        genre: [],
        externalProvider: 'openlibrary',
        externalItemId: '9780140328721',
        externalIds: [{ source: 'isbn', id: '9780140328721' }],
        tags: [],
        year: '1988',
        rate: '',
        rottenTomatoesRate: '',
        metacriticRate: '',
        userRate: null,
        actors: 'Author',
        plot: 'Plot',
        contentType: 'book',
        favorite: false,
        listType: 'tracking',
        progressCurrent: 240,
        progressTotal: 240,
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        listType: 'tracking',
        contentType: 'book',
        progressCurrent: 240,
        progressTotal: 240,
        watchedAt: expect.any(String),
      }),
    });
  });

  it('returns 400 when creating an item without a type tag', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, contentType: 'other', tags: ['#action'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts a former virtual tag as a custom tag when creating an item', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, tags: ['#unwatched'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ tags: ['#unwatched'] }) });
  });

  it('accepts a former system tag name as a custom tag when creating an item', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, tags: ['#movie'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ tags: ['#movie'] }) });
  });

  it('creates an item in a shared library when create permission is granted', async () => {
    insertUser('owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canCreate: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: getUserShareCode('owner') }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ title: 'Custom File' }) });
    expect(
      getDatabase()
        .prepare('SELECT title FROM collection_items WHERE username_hash = ? AND external_item_id = ?')
        .get('owner', 'tt0000001')
    ).toEqual({ title: 'Custom File' });
  });

  it('returns 403 when creating in a shared library without create permission', async () => {
    insertUser('owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: getUserShareCode('owner') }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the target shared library does not exist', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: 'missing-share-code' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 409 when an IMDb identity already exists', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'imdb', 'tt0000001', 'imdb:tt0000001', 'Existing', '', '', '', '', 'hash');
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 400 when title is invalid', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, title: '' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when watch later is combined with favorite', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'up-next', favorite: true }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when wishlist is combined with favorite', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'wishlist', favorite: true }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when watch later is combined with wishlist', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, favorite: 'yes' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 when creating into an unknown shared owner code', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      body: { ...item, listType: 'up-next', targetOwnerShareCode: 'missing-share-code' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 403 when creating wishlist without grant for that scope', async () => {
    insertUser('owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canCreate: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      body: { ...item, listType: 'wishlist', targetOwnerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 500 on unexpected DB error', async () => {
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'missing-user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
