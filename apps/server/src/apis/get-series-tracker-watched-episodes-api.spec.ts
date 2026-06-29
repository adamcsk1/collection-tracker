import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertSeriesTrackerItem } from '../../test/mocks/series-tracker-item-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('get-series-tracker-watched-episodes-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns empty watched episodes when none exist', async () => {
    insertSeriesTrackerItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ watchedEpisodes: [], lastWatchedEpisode: null });
  });

  it('returns watched episodes and last watched episode', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 2, 5);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      watchedEpisodes: [
        { season: 1, episode: 2 },
        { season: 2, episode: 5 },
      ],
      lastWatchedEpisode: { season: 2, episode: 5 },
    });
  });

  it('returns watched episodes by canonical alias', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('UPDATE collection_items SET canonical_item_id = ? WHERE id = ?')
      .run('imdb:tt-series', itemId);
    getDatabase()
      .prepare(
        `INSERT INTO external_item_identities
          (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('user', 'imdb:tt-series', 'imdb', 'tt-series', 'provider');
    getDatabase()
      .prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)')
      .run(itemId, 1, 2);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      watchedEpisodes: [{ season: 1, episode: 2 }],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });
  });

  it('returns 404 for non-existent item', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-unknown' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-watched-episodes-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
