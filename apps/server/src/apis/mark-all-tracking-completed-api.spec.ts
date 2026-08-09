import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertTrackingItem } from '../../test/mocks/tracking-item-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
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
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ totalSeasons: '1' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Episodes: [{}, {}] }) })
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

  it('returns 400 when no season metadata exists', async () => {
    vi.stubEnv('OMDB_API_KEY', '');
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
