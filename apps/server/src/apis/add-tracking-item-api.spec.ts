import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  usernameHash: string,
  imdbId: string,
  tags: string[],
  listType = 'watchlist',
  contentType = 'series'
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, 'omdb', imdbId, `omdb:${imdbId}`, listType, 'Title', 'title', '', '', '', 'hash', contentType);
  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT OR IGNORE INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, `omdb:${imdbId}`, 'imdb', imdbId, 'alias');
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(itemId, null);
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
};

const insertShare = (ownerHash: string, sharedWithHash: string, canRead: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, canRead ? 1 : 0, 0, 0, 0);
};

describe('add-tracking-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OMDB_API_KEY;
  });

  it('moves an own watch later series to tracking and fetches metadata', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#watchlist']);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'watchlist' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'series',
        tags: ['#series', '#watchlist'],
      }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'watchlist')
    ).toBeUndefined();
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracker_seasons.season, series_tracker_seasons.episodes
           FROM series_tracker_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracker_seasons.item_id
            WHERE collection_items.external_item_id = ?`
        )
        .all('tt-1')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      query: { sourceListType: 'watchlist' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('copies an own library series to tracking and fetches metadata', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: {},
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'series',
        tags: ['#series'],
      }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'library')
    ).toEqual({ 1: 1 });
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracker_seasons.season, series_tracker_seasons.episodes
           FROM series_tracker_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracker_seasons.item_id
            WHERE collection_items.external_item_id = ? AND collection_items.list_type = ?`
        )
        .all('tt-1', 'tracking')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('fetches series metadata by default when the query flag is omitted', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: {},
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracker_seasons.season, series_tracker_seasons.episodes
           FROM series_tracker_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracker_seasons.item_id
            WHERE collection_items.external_item_id = ? AND collection_items.list_type = ?`
        )
        .all('tt-1', 'tracking')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('copies a readable shared library series and keeps the shared source item', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('owner', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }),
    });
    expect(
      getDatabase()
        .prepare(
          'SELECT username_hash, list_type FROM collection_items WHERE external_item_id = ? ORDER BY username_hash'
        )
        .all('tt-1')
    ).toEqual([
      { username_hash: 'owner', list_type: 'library' },
      { username_hash: 'user', list_type: 'tracking' },
    ]);
  });

  it('returns 403 when copying from a shared library without read permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', false);
    insertItem('owner', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
  });

  it('moves a watchlist movie to tracking', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#watchlist'], 'watchlist', 'movie');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'watchlist' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking', contentType: 'movie' }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'watchlist')
    ).toBeUndefined();
  });

  it('removes watch later series when it already exists in tracking', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#watchlist']);
    insertItem('user', 'tt-1', ['#series'], 'tracking');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'watchlist' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'watchlist')
    ).toBeUndefined();
  });
});
