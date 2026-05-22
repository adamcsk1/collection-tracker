import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
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
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ seasons: [] });
  });
});
