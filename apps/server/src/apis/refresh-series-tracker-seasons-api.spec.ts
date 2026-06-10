import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { COMPLETED_TAG } from '@shared/constants/tags-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('refresh-series-tracker-seasons-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('refreshes metadata from OMDb and keeps partial successes', async () => {
    insertSeriesTrackerItem();
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
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }],
        item: expect.objectContaining({ IMDbId: 'tt-series' }),
      })
    );
  });

  it('syncs completed tag after refreshed metadata changes completion status', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
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
    const request: any = { params: { imdbId: 'tt-series' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?')
        .get(itemId, COMPLETED_TAG)
    ).toBeTruthy();
  });
});
