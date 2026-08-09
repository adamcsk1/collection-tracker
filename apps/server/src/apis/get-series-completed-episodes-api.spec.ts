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
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(itemId, null);
  return itemId;
};

describe('get-watching-completed-episodes-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns empty watched episodes when none exist', async () => {
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ completedEpisodes: [], lastCompletedEpisode: null });
  });

  it('returns watched episodes and last watched episode', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 2, 5);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      completedEpisodes: [
        { season: 1, episode: 2 },
        { season: 2, episode: 5 },
      ],
      lastCompletedEpisode: { season: 2, episode: 5 },
    });
  });

  it('returns shared owner completed episodes with exact read permission', async () => {
    insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(ownerItemId, 3, 4);
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

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      completedEpisodes: [{ season: 3, episode: 4 }],
      lastCompletedEpisode: { season: 3, episode: 4 },
    });
  });

  it('rejects shared owner completed episodes without exact read permission', async () => {
    insertTrackingItem('user');
    insertTrackingItem('owner');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
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
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns watched episodes by canonical alias', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('UPDATE collection_items SET canonical_item_id = ? WHERE id = ?')
      .run('imdb:tt-series', itemId);
    getDatabase()
      .prepare(
        `INSERT INTO external_item_identities
          (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('user', 'imdb:tt-series', 'imdb', 'tt-series', 'alias');
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      completedEpisodes: [{ season: 1, episode: 2 }],
      lastCompletedEpisode: { season: 1, episode: 2 },
    });
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-unknown' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-completed-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
