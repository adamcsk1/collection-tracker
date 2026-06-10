import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { COMPLETED_TAG } from '@shared/constants/tags-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('change-series-tracker-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('replaces metadata with validated manual values', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 2, episodes: 8 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 2, episodes: 8, titles: [] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('rejects zero episode counts', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 0 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects episode counts above the supported range', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 101 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('saves and returns episode titles', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('removes completed tag when new season metadata is no longer fully watched', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase().prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, COMPLETED_TAG);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 2 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?')
        .get(itemId, COMPLETED_TAG)
    ).toBeUndefined();
  });

  it('prunes watched episodes outside replaced season metadata before syncing completion', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase().prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, COMPLETED_TAG);
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 3);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?), (?, ?, ?)')
      .run(itemId, 1, 1, itemId, 1, 3);
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-series' },
      body: { seasons: [{ season: 1, episodes: 1 }] },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare(
          'SELECT season, episode FROM series_tracker_watched_episodes WHERE item_id = ? ORDER BY season, episode'
        )
        .all(itemId)
    ).toEqual([{ season: 1, episode: 1 }]);
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?')
        .get(itemId, COMPLETED_TAG)
    ).toBeTruthy();
  });
});
