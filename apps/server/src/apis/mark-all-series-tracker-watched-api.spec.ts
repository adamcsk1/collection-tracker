import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { COMPLETED_TAG } from '@shared/constants/tags-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mark-all-series-tracker-watched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('marks all episodes as watched when seasons exist', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 3);
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 2, 2);
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-tracker-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
          { season: 2, episode: 1 },
          { season: 2, episode: 2 },
        ],
        lastWatchedEpisode: { season: 2, episode: 2 },
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?')
        .get(itemId, COMPLETED_TAG)
    ).toBeTruthy();
  });

  it('returns 400 when no season metadata exists', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-tracker-watched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-unknown' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-series-tracker-watched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
