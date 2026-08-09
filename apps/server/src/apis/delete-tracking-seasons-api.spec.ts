import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertTrackingItem = (): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run('user', 'omdb', 'tt-series', 'imdb:tt-series', 'tracking', 'Series', 'series', '', '', '', 'hash', 'series');
  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run('user', 'imdb:tt-series', 'imdb', 'tt-series', 'alias');
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(itemId, null);
  return itemId;
};

describe('delete-tracking-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes metadata', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 10);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    getDatabase()
      .prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?')
      .run('2025-01-01 00:00:00', itemId);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ seasons: [], item: expect.objectContaining({ IMDbId: 'tt-series' }) })
    );
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: null,
    });
    expect(
      getDatabase().prepare('SELECT 1 FROM series_completed_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });
});
