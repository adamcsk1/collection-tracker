import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertTrackingItem } from '../../test/mocks/tracking-item-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { insertShare } from '../../test/mocks/share-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('refresh-tracking-seasons-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('refreshes metadata from OMDb and keeps partial successes', async () => {
    insertTrackingItem();
    process.env.OMDB_API_KEY = 'key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '2' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }, { Title: 'Episode 2' }] }),
      })
      .mockRejectedValueOnce(new Error('season failed'));
    vi.stubGlobal('fetch', fetchMock);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('refreshes metadata through the stored provider when addressed by IMDb identity', async () => {
    insertTrackingItem();
    getDatabase()
      .prepare('UPDATE collection_items SET canonical_item_id = ? WHERE username_hash = ? AND external_item_id = ?')
      .run('imdb:tt-series', 'user', 'tt-series');
    process.env.OMDB_API_KEY = 'key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('i=tt-series'));
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ seasons: [{ season: 1, episodes: 1, titles: ['Pilot'] }] })
    );
  });

  it('refreshes only shared owner metadata with exact update permission', async () => {
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
        readMode: 'all',
      },
    ]);
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }] }) })
    );
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(ownerItemId)
    ).toEqual([{ season: 1, episodes: 1 }]);
    expect(
      getDatabase().prepare('SELECT season, episodes FROM series_tracking_seasons WHERE item_id = ?').all(viewerItemId)
    ).toEqual([{ season: 1, episodes: 9 }]);
  });

  it('rejects shared owner refresh without exact update permission', async () => {
    insertTrackingItem('user');
    insertTrackingItem('owner');
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'tracking',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      query: { ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when external provider is unsupported', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets watched timestamp after refreshed metadata changes completion status', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }] }) })
    );
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: expect.any(String),
    });
  });

  it('clears watched timestamp when refreshed metadata adds unwatched episodes', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?')
      .run('2025-01-01 00:00:00', itemId);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }, { Title: 'Episode 2' }] }),
        })
    );
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(itemId)
    ).toEqual({
      completed_at: null,
    });
  });

  it('prunes watched episodes outside refreshed metadata before syncing completion', async () => {
    const itemId = insertTrackingItem();
    getDatabase()
      .prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?')
      .run('2025-01-01 00:00:00', itemId);
    getDatabase()
      .prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?), (?, ?, ?)')
      .run(itemId, 1, 1, itemId, 1, 3);
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{ Title: 'Pilot' }] }) })
    );
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-tracking-seasons-api');
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
