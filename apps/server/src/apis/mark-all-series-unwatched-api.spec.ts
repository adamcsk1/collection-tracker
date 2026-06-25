import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (imdbId: string, tags: string[] = [], listType = 'library', usernameHash = 'user') => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, listType, 'Title', 'title', '', '', '', '', `${usernameHash}-${listType}-${imdbId}`);
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

describe('mark-all-series-unwatched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears matching series tracker watched progress and keeps tracker metadata', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('tt-shared', ['#series'], 'library', 'owner');
    const trackerItemId = insertItem('tt-shared', ['#series', '#completed'], 'series-tracker', 'user');
    insertItem('tt-own-only', ['#series'], 'library', 'user');
    const ownTrackerItemId = insertItem('tt-own-only', ['#series', '#completed'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(ownTrackerItemId, 1, 1);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 1);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(ownTrackerItemId, 1, 1);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-unwatched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare('SELECT imdb_id FROM collection_items WHERE username_hash = ? AND list_type = ? ORDER BY imdb_id')
        .all('user', 'series-tracker')
    ).toEqual([{ imdb_id: 'tt-own-only' }, { imdb_id: 'tt-shared' }]);
    expect(getDatabase().prepare('SELECT 1 FROM series_tracker_seasons WHERE item_id = ?').get(trackerItemId)).toEqual({
      1: 1,
    });
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(trackerItemId)
    ).toBeUndefined();
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(ownTrackerItemId)
    ).toEqual({ 1: 1 });
    expect(
      getDatabase().prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(trackerItemId)
    ).toEqual([{ tag: '#series' }]);
    expect(
      getDatabase().prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(ownTrackerItemId)
    ).toEqual([{ tag: '#completed' }, { tag: '#series' }]);
  });

  it('returns 0 when matching series tracker items already have no watched state', async () => {
    insertUser('user');
    insertItem('tt-1', ['#series'], 'library', 'user');
    const trackerItemId = insertItem('tt-1', ['#series'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-unwatched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
    expect(getDatabase().prepare('SELECT 1 FROM collection_items WHERE id = ?').get(trackerItemId)).toEqual({ 1: 1 });
  });

  it('clears tracker-only series progress when My Library is selected', async () => {
    insertUser('user');
    const trackerItemId = insertItem('tt-tracker-only', ['#series', '#completed'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(trackerItemId, 1, 1);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-unwatched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(getDatabase().prepare('SELECT 1 FROM series_tracker_seasons WHERE item_id = ?').get(trackerItemId)).toEqual({
      1: 1,
    });
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(trackerItemId)
    ).toBeUndefined();
    expect(
      getDatabase().prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(trackerItemId)
    ).toEqual([{ tag: '#series' }]);
  });

  it('does not clear unrelated tracker-only progress when a shared library is selected', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('tt-shared', ['#series'], 'library', 'owner');
    const trackerOnlyItemId = insertItem('tt-tracker-only', ['#series', '#completed'], 'series-tracker', 'user');
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(trackerOnlyItemId, 1, 1);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-unwatched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(trackerOnlyItemId)
    ).toEqual({ 1: 1 });
    expect(
      getDatabase()
        .prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag')
        .all(trackerOnlyItemId)
    ).toEqual([{ tag: '#completed' }, { tag: '#series' }]);
  });

  it('returns 404 when the shared library owner is missing', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-unwatched-api');
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

    const { register } = await import('./mark-all-series-unwatched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
  });
});
