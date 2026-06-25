import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  imdbId: string,
  tags: string[] = [],
  listType = 'library',
  usernameHash = 'user',
  contentType = 'series'
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      imdbId,
      listType,
      'Title',
      'title',
      '',
      '',
      '',
      '',
      `${usernameHash}-${listType}-${imdbId}`,
      contentType
    );
  const itemId = Number(result.lastInsertRowid);
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  return itemId;
};

const insertShare = (ownerHash: string, sharedWithHash: string, canRead: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, canRead ? 1 : 0, 0, 0, 0);
};

describe('mark-all-series-watched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OMDB_API_KEY;
  });

  it('copies selected library series to the series tracker and marks fetched episodes watched', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
    );
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('tt-own', ['#series'], 'library', 'user');
    insertItem('tt-shared', ['#series'], 'library', 'owner');
    insertItem('tt-movie', ['#movie'], 'library', 'owner', 'movie');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ trackedCount: 1, progressChangedCount: 1 });
    expect(
      getDatabase()
        .prepare('SELECT username_hash, imdb_id, list_type FROM collection_items WHERE list_type = ?')
        .all('series-tracker')
    ).toEqual([{ username_hash: 'user', imdb_id: 'tt-shared', list_type: 'series-tracker' }]);
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracker_seasons.season, series_tracker_seasons.episodes
           FROM series_tracker_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracker_seasons.item_id
           WHERE collection_items.imdb_id = ?`
        )
        .all('tt-shared')
    ).toEqual([{ season: 1, episodes: 2 }]);
    expect(
      getDatabase()
        .prepare(
          `SELECT watched_episodes.season, watched_episodes.episode
           FROM series_tracker_watched_episodes AS watched_episodes
           INNER JOIN collection_items ON collection_items.id = watched_episodes.item_id
           WHERE collection_items.imdb_id = ?
           ORDER BY watched_episodes.season, watched_episodes.episode`
        )
        .all('tt-shared')
    ).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(
      getDatabase()
        .prepare(
          `SELECT content_type, watched_at
           FROM collection_items
           WHERE imdb_id = ? AND list_type = ?`
        )
        .get('tt-shared', 'series-tracker')
    ).toEqual({ content_type: 'series', watched_at: expect.any(String) });
  });

  it('marks existing series tracker episodes watched without fetching metadata again', async () => {
    process.env.OMDB_API_KEY = 'key';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    insertUser('user');
    insertItem('tt-1', ['#series'], 'library', 'user');
    const trackerItemId = insertItem('tt-1', ['#series'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ trackedCount: 0, progressChangedCount: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(
      getDatabase()
        .prepare(
          `SELECT season, episode
           FROM series_tracker_watched_episodes
           WHERE item_id = ?
           ORDER BY season, episode`
        )
        .all(trackerItemId)
    ).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(getDatabase().prepare('SELECT watched_at FROM collection_items WHERE id = ?').get(trackerItemId)).toEqual({
      watched_at: expect.any(String),
    });
  });

  it('counts progress changed when only the completed timestamp changes', async () => {
    process.env.OMDB_API_KEY = 'key';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    insertUser('user');
    insertItem('tt-1', ['#series'], 'library', 'user');
    const trackerItemId = insertItem('tt-1', ['#series'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?), (?, ?, ?)')
      .run(trackerItemId, 1, 1, trackerItemId, 1, 2);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ trackedCount: 0, progressChangedCount: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(getDatabase().prepare('SELECT watched_at FROM collection_items WHERE id = ?').get(trackerItemId)).toEqual({
      watched_at: expect.any(String),
    });
  });

  it('marks tracker-only series watched when My Library is selected', async () => {
    process.env.OMDB_API_KEY = 'key';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    insertUser('user');
    const trackerItemId = insertItem('tt-tracker-only', ['#series'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ trackedCount: 0, progressChangedCount: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(
      getDatabase()
        .prepare(
          `SELECT season, episode
           FROM series_tracker_watched_episodes
           WHERE item_id = ?
           ORDER BY season, episode`
        )
        .all(trackerItemId)
    ).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(getDatabase().prepare('SELECT watched_at FROM collection_items WHERE id = ?').get(trackerItemId)).toEqual({
      watched_at: expect.any(String),
    });
  });

  it('does not mark unrelated tracker-only series watched when a shared library is selected', async () => {
    process.env.OMDB_API_KEY = 'key';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('tt-shared', ['#series'], 'library', 'owner');
    const trackerOnlyItemId = insertItem('tt-tracker-only', ['#series'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerOnlyItemId, 1, 1);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(trackerOnlyItemId)
    ).toBeUndefined();
  });

  it('returns 404 when the shared library owner is missing', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith();
  });

  it('returns 403 when the user cannot read the shared library', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', false);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-watched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
  });
});
