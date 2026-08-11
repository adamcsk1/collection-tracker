import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { insertShare } from '../../test/mocks/share-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertTrackingItem = (usernameHash = 'user'): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
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

describe('change-tracking-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('replaces metadata with validated manual values', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 2, episodes: 8 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 2, episodes: 8, titles: [] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('updates only shared owner metadata with exact update permission', async () => {
    const viewerItemId = insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?), (?, ?, ?)')
      .run(viewerItemId, 1, 1, ownerItemId, 1, 2);
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'tracking',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { seasons: [{ season: 2, episodes: 8 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(ownerItemId)
    ).toEqual([{ season: 2, episodes: 8 }]);
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(viewerItemId)
    ).toEqual([{ season: 1, episodes: 1 }]);
  });

  it('rejects shared owner metadata changes without exact update permission', async () => {
    insertTrackingItem('user');
    insertTrackingItem('owner');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { seasons: [{ season: 2, episodes: 8 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('rejects tracking items outside the series scope', async () => {
    const itemId = insertTrackingItem();
    getDatabase().prepare('UPDATE collection_items SET content_type = ? WHERE id = ?').run('movie', itemId);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('rejects zero episode counts', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 0 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects episode counts above the supported range', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 101 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('saves and returns episode titles', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('clears watched timestamp when new season metadata is no longer fully watched', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?')
      .run('2025-01-01 00:00:00', itemId);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 2 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: null,
    });
  });

  it('prunes watched episodes outside replaced season metadata before syncing completion', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 3);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?), (?, ?, ?)')
      .run(itemId, 1, 1, itemId, 1, 3);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare('SELECT season, episode FROM series_completed_episodes WHERE item_id = ? ORDER BY season, episode')
        .all(itemId)
    ).toEqual([{ season: 1, episode: 1 }]);
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
  });
});
