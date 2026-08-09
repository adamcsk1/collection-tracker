import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { insertShare } from '../../test/mocks/share-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertTrackingItem = (usernameHash = 'user'): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(
    usernameHash,
    `${usernameHash}-token`
  );
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'omdb',
      'tt-series',
      'imdb:tt-series',
      'tracking',
      'Series',
      'series',
      '',
      '',
      '',
      'hash',
      'series'
    );
  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, 'imdb:tt-series', 'imdb', 'tt-series', 'alias');
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

  it('deletes only shared owner metadata with exact update permission', async () => {
    const viewerItemId = insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?), (?, ?, ?)')
      .run(viewerItemId, 1, 9, ownerItemId, 1, 2);
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'tracking',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
      },
    ]);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT season FROM series_tracking_seasons WHERE item_id = ?').all(ownerItemId)
    ).toEqual([]);
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(viewerItemId)
    ).toEqual([{ season: 1, episodes: 9 }]);
  });

  it('rejects shared owner delete without exact update permission', async () => {
    insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(ownerItemId, 1, 2);
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'tracking',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    ]);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(ownerItemId)
    ).toEqual([{ season: 1, episodes: 2 }]);
  });
});
