import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertSeriesTrackerItem = (): number => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'user',
      'omdb',
      'tt-series',
      'imdb:tt-series',
      'series-tracker',
      'Series',
      'series',
      '',
      '',
      '',
      'hash',
      'series'
    );
  const itemId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(itemId, null);
  return itemId;
};

describe('get-series-tracker-seasons-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns stored season metadata', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 10);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ seasons: [{ season: 1, episodes: 10, titles: [] }] });
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns stored episode titles', async () => {
    const itemId = insertSeriesTrackerItem();
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles) VALUES (?, ?, ?, ?)')
      .run(itemId, 1, 2, JSON.stringify(['Pilot', 'Episode 2']));
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Episode 2'] }],
    });
  });

  it('returns stored season metadata by canonical alias', async () => {
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
      .run('user', 'imdb:tt-series', 'imdb', 'tt-series', 'alias');
    getDatabase()
      .prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)')
      .run(itemId, 1, 10);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-series' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-series-tracker-seasons-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ seasons: [{ season: 1, episodes: 10, titles: [] }] });
  });
});
