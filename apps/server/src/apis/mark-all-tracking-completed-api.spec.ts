import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertTrackingItem } from '../../test/mocks/tracking-item-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metadataServiceResponse } from '../../test/mocks/metadata-service-response-mock';
import { insertShare, insertShareTestCollectionItem } from '../../test/mocks/share-mock';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { replaceCollectionItemSelections } from '../core/database/repositories/share-repository';
import { findCollectionItemByExternalIdOrCanonicalItemId } from '../core/database/repositories/collection';

describe('mark-all-tracking-completed-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('marks all episodes as watched when seasons exist', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 3);
    getDatabase()
      .prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 2, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
          { season: 2, episode: 1 },
          { season: 2, episode: 2 },
        ],
        lastCompletedEpisode: { season: 2, episode: 2 },
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
  });

  it('fetches missing season metadata before marking all episodes watched', async () => {
    vi.stubEnv('OMDB_API_KEY', 'key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }))
    );
    const itemId = insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastCompletedEpisode: { season: 1, episode: 2 },
        item: expect.objectContaining({ IMDbId: 'tt-series', watchedAt: expect.any(String) }),
      })
    );
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(itemId)
    ).toEqual([{ season: 1, episodes: 2 }]);
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
  });

  it('fetches missing season metadata for items matched by imdb identity', async () => {
    vi.stubEnv('OMDB_API_KEY', 'key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }))
    );
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastCompletedEpisode: { season: 1, episode: 2 },
        item: expect.objectContaining({ IMDbId: 'tt-series', watchedAt: expect.any(String) }),
      })
    );
  });

  it.each([
    { missingMetadata: false, selected: false },
    { missingMetadata: true, selected: false },
    { missingMetadata: true, selected: true },
  ])('completes only the shared owner series with %j', async ({ missingMetadata, selected }) => {
    const fetchSpy = vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const actorItemId = insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    const db = getDatabase();
    db.prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(
      actorItemId,
      3,
      4
    );
    db.prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
      actorItemId,
      3,
      1
    );
    if (!missingMetadata) {
      db.prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(
        ownerItemId,
        1,
        2
      );
    }
    insertShare(
      db,
      'owner',
      'user',
      selected
        ? []
        : [
            {
              listType: 'tracking',
              contentType: 'series',
              canRead: true,
              canCreate: false,
              canUpdate: true,
              canDelete: false,
              readMode: 'all',
            },
          ]
    );
    if (selected) {
      db.prepare(
        `INSERT INTO user_share_grants
         (owner_username_hash, shared_with_username_hash, list_type, content_type,
          can_read, can_create, can_update, can_delete, scope_mode)
         VALUES ('owner', 'user', 'tracking', 'series', 1, 0, 1, 0, 'selected')`
      ).run();
      replaceCollectionItemSelections(
        db,
        'owner',
        findCollectionItemByExternalIdOrCanonicalItemId(db, 'owner', 'omdb', 'tt-series', 'tracking')!,
        [
          {
            sharedWithUsernameHash: 'user',
            permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
          },
        ]
      );
    }
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
        query: { ownerShareCode: getUserShareCode('owner') },
        usernameHash: 'user',
      },
      response
    );
    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastCompletedEpisode: { season: 1, episode: 2 },
        item: expect.objectContaining({ IMDbId: 'tt-series', watchedAt: expect.any(String) }),
      })
    );
    expect(
      db.prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(ownerItemId)
    ).toEqual([{ season: 1, episodes: 2 }]);
    expect(
      db
        .prepare('SELECT season, episode FROM series_completed_episodes WHERE item_id = ? ORDER BY season, episode')
        .all(ownerItemId)
    ).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(
      db.prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(ownerItemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
    expect(
      db.prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(actorItemId)
    ).toEqual([{ season: 3, episodes: 4 }]);
    expect(
      db.prepare('SELECT season, episode FROM series_completed_episodes WHERE item_id = ?').all(actorItemId)
    ).toEqual([{ season: 3, episode: 1 }]);
    expect(
      db.prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(actorItemId)
    ).toEqual({ completed_at: null });
    expect(fetchSpy).toHaveBeenCalledTimes(missingMetadata ? 1 : 0);
  });

  it.each([
    { scenario: 'no grant', status: 403 },
    { scenario: 'read only', status: 403 },
    { scenario: 'library grant', status: 403 },
    { scenario: 'movie grant', status: 403 },
    { scenario: 'unselected item', status: 403 },
    { scenario: 'non-series item', status: 404 },
    { scenario: 'non-tracking item', status: 404 },
    { scenario: 'unknown owner', status: 404 },
  ])('rejects $scenario without fetching or changing either account', async ({ scenario, status }) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const actorItemId = insertTrackingItem('user');
    const ownerItemId = insertTrackingItem('owner');
    const db = getDatabase();
    db.prepare('INSERT INTO series_tracking_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(
      actorItemId,
      1,
      2
    );
    db.prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
      actorItemId,
      1,
      1
    );
    if (scenario !== 'no grant') {
      insertShare(
        db,
        'owner',
        'user',
        scenario === 'unselected item'
          ? []
          : [
              {
                listType: scenario === 'library grant' ? 'library' : 'tracking',
                contentType: scenario === 'movie grant' ? 'movie' : 'series',
                canRead: true,
                canCreate: false,
                canUpdate: scenario !== 'read only',
                canDelete: false,
                readMode: 'all',
              },
            ]
      );
    }
    if (scenario === 'unselected item') {
      db.prepare(
        `INSERT INTO user_share_grants
         (owner_username_hash, shared_with_username_hash, list_type, content_type,
          can_read, can_create, can_update, can_delete, scope_mode)
         VALUES ('owner', 'user', 'tracking', 'series', 1, 0, 1, 0, 'selected')`
      ).run();
      const selectedItemId = insertShareTestCollectionItem(db, 'owner', 'tt-selected');
      db.prepare('UPDATE collection_items SET list_type = ?, content_type = ? WHERE id = ?').run(
        'tracking',
        'series',
        selectedItemId
      );
      replaceCollectionItemSelections(
        db,
        'owner',
        findCollectionItemByExternalIdOrCanonicalItemId(db, 'owner', 'imdb', 'tt-selected', 'tracking')!,
        [
          {
            sharedWithUsernameHash: 'user',
            permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
          },
        ]
      );
    }
    if (scenario === 'non-series item') {
      db.prepare('UPDATE collection_items SET content_type = ? WHERE id = ?').run('movie', ownerItemId);
    }
    if (scenario === 'non-tracking item') {
      db.prepare('UPDATE collection_items SET list_type = ? WHERE id = ?').run('library', ownerItemId);
    }
    const itemsBefore = db.prepare('SELECT * FROM collection_items ORDER BY id').all();
    const seasonsBefore = db.prepare('SELECT * FROM series_tracking_seasons ORDER BY item_id, season').all();
    const episodesBefore = db
      .prepare('SELECT * FROM series_completed_episodes ORDER BY item_id, season, episode')
      .all();
    const stateBefore = db.prepare('SELECT * FROM collection_item_tracker_state ORDER BY item_id').all();
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
        query: { ownerShareCode: scenario === 'unknown owner' ? 'unknown-owner' : getUserShareCode('owner') },
        usernameHash: 'user',
      },
      response
    );
    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(status);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.prepare('SELECT * FROM collection_items ORDER BY id').all()).toEqual(itemsBefore);
    expect(db.prepare('SELECT * FROM series_tracking_seasons ORDER BY item_id, season').all()).toEqual(seasonsBefore);
    expect(db.prepare('SELECT * FROM series_completed_episodes ORDER BY item_id, season, episode').all()).toEqual(
      episodesBefore
    );
    expect(db.prepare('SELECT * FROM collection_item_tracker_state ORDER BY item_id').all()).toEqual(stateBefore);
  });

  it('returns 400 when no season metadata exists', async () => {
    vi.stubEnv('OMDB_API_KEY', '');
    const { setAvailableExternalMetadataProviders } =
      await import('../core/external-metadata/external-metadata-provider-factory');
    setAvailableExternalMetadataProviders(['openlibrary', 'musicbrainz']);
    insertTrackingItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-unknown' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-tracking-completed-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
