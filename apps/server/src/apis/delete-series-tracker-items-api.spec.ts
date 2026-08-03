import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (usernameHash: string, imdbId: string, listType = 'series-tracker'): number => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'imdb',
      imdbId,
      `imdb:${imdbId}`,
      listType,
      'Title',
      'title',
      '',
      '',
      '',
      `${usernameHash}-${listType}-${imdbId}`,
      listType === 'series-tracker' ? 'series' : 'movie'
    );
  return Number(result.lastInsertRowid);
};

describe('delete-series-tracker-items-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes all current user series tracker items and cascades tracker metadata only', async () => {
    insertUser('user');
    insertUser('other-user');
    const deletedItemId = insertItem('user', 'tt-1');
    insertItem('user', 'tt-library', 'library');
    const retainedItemId = insertItem('other-user', 'tt-other');
    const db = getDatabase();
    db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(
      deletedItemId,
      1,
      2
    );
    db.prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
      deletedItemId,
      1,
      1
    );
    db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(
      retainedItemId,
      1,
      2
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-series-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    const rows = db
      .prepare('SELECT username_hash, external_item_id, list_type FROM collection_items ORDER BY external_item_id')
      .all();
    expect(rows).toEqual([
      { username_hash: 'user', external_item_id: 'tt-library', list_type: 'library' },
      { username_hash: 'other-user', external_item_id: 'tt-other', list_type: 'series-tracker' },
    ]);
    expect(db.prepare('SELECT 1 FROM series_tracker_seasons WHERE item_id = ?').get(deletedItemId)).toBeUndefined();
    expect(
      db.prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(deletedItemId)
    ).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM series_tracker_seasons WHERE item_id = ?').get(retainedItemId)).toEqual({ 1: 1 });
  });

  it('returns zero when the current user has no series tracker items', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-series-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });
});
