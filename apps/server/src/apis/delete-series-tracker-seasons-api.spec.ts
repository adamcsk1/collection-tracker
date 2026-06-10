import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { COMPLETED_TAG } from '@shared/constants/tags-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('delete-series-tracker-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes metadata', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 10);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 1);
    getDatabase().prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, COMPLETED_TAG);
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ seasons: [], item: expect.objectContaining({ IMDbId: 'tt-series' }) })
    );
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?')
        .get(itemId, COMPLETED_TAG)
    ).toBeUndefined();
    expect(
      getDatabase().prepare('SELECT 1 FROM series_tracker_watched_episodes WHERE item_id = ?').get(itemId)
    ).toBeUndefined();
  });
});
