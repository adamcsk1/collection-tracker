import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('change-series-tracker-watched-episodes-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('replaces watched episodes and returns sorted list', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?), (?, ?, ?)')
      .run(itemId, 1, 5, itemId, 2, 3);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        watchedEpisodes: [
          { season: 2, episode: 3 },
          { season: 1, episode: 5 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedEpisodes: [
          { season: 1, episode: 5 },
          { season: 2, episode: 3 },
        ],
        lastWatchedEpisode: { season: 2, episode: 3 },
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('clears all watched episodes when empty array is sent', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: [] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedEpisodes: [],
        lastWatchedEpisode: null,
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('sets watched timestamp when all episodes are watched', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(getDatabase().prepare('SELECT watched_at FROM collection_items WHERE id = ?').get(itemId)).toEqual({
      watched_at: expect.any(String),
    });
  });

  it('rejects watched episodes outside saved metadata', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 2, episode: 1 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });

  it('rejects watched episode numbers above saved season episode count', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: [{ season: 1, episode: 3 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });

  it('clears watched timestamp when not all episodes are watched', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    getDatabase().prepare('UPDATE collection_items SET watched_at = ? WHERE id = ?').run('2025-01-01 00:00:00', itemId);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: [{ season: 1, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(getDatabase().prepare('SELECT watched_at FROM collection_items WHERE id = ?').get(itemId)).toEqual({
      watched_at: null,
    });
  });

  it('rejects invalid season numbers', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: [{ season: 0, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects invalid episode numbers', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: [{ season: 1, episode: 0 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects duplicate episodes', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: {
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 1 },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects non-array body', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      body: { watchedEpisodes: null },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-unknown' },
      body: { watchedEpisodes: [{ season: 1, episode: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
