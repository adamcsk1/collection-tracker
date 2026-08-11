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

describe('change-watching-completed-episodes-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('replaces watched episodes and returns sorted list', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?), (?, ?, ?)')
      .run(itemId, 1, 5, itemId, 2, 3);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        completedEpisodes: [
          { season: 2, episode: 3 },
          { season: 1, episode: 5 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [
          { season: 1, episode: 5 },
          { season: 2, episode: 3 },
        ],
        lastCompletedEpisode: { season: 2, episode: 3 },
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('updates only shared owner completed episodes with exact update permission', async () => {
    const viewerItemId = insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?), (?, ?, ?)')
      .run(viewerItemId, 1, 2, ownerItemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(viewerItemId, 1, 1);
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
      body: { completedEpisodes: [{ season: 1, episode: 2 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT season, episode FROM series_completed_episodes WHERE item_id = ?').all(ownerItemId)
    ).toEqual([{ season: 1, episode: 2 }]);
    expect(
      getDatabase().prepare('SELECT season, episode FROM series_completed_episodes WHERE item_id = ?').all(viewerItemId)
    ).toEqual([{ season: 1, episode: 1 }]);
  });

  it('rejects shared owner completed episode changes without exact update permission', async () => {
    insertTrackingItem('user');
    insertTrackingItem('owner');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { completedEpisodes: [] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
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
      body: { completedEpisodes: [] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('clears all watched episodes when empty array is sent', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: [] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [],
        lastCompletedEpisode: null,
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('sets watched timestamp when all episodes are watched', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
  });

  it('rejects watched episodes outside saved metadata', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 2, episode: 1 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(
      getDatabase().prepare('SELECT 1 FROM series_completed_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });

  it('rejects watched episode numbers above saved season episode count', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: [{ season: 1, episode: 3 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(
      getDatabase().prepare('SELECT 1 FROM series_completed_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });

  it('clears watched timestamp when not all episodes are watched', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    getDatabase()
      .prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?')
      .run('2025-01-01 00:00:00', itemId);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: [{ season: 1, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: null,
    });
  });

  it('rejects invalid season numbers', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: [{ season: 0, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects invalid episode numbers', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: [{ season: 1, episode: 0 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects duplicate episodes', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 1 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects non-array body', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { completedEpisodes: null },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-unknown' },
      body: { completedEpisodes: [{ season: 1, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
