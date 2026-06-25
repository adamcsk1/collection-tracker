import { mockResponse } from '../../test/mocks/response-mock';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const buildRouteApp = () =>
  ({
    post: vi.fn(),
  }) as any;

const getPostHandler = (app: { post: ReturnType<typeof vi.fn> }, path: string) => {
  const call = app.post.mock.calls.find(([routePath]) => routePath === path);
  return call?.[2] as ((request: any, response: any) => Promise<void> | void) | undefined;
};

const item = {
  image: 'poster.jpg',
  title: 'Imported Movie',
  titleLower: 'imported movie',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  tags: ['#movie'],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One, Actor Two',
  plot: 'Plot',
  hash: 'hash',
  listType: 'library',
};

const seriesTrackerItem = {
  ...item,
  title: 'Imported Series',
  titleLower: 'imported series',
  IMDbId: 'tt0000002',
  tags: ['#series'],
  listType: 'series-tracker',
};

const movieTrackerItem = {
  ...item,
  title: 'Imported Tracker Movie',
  titleLower: 'imported tracker movie',
  IMDbId: 'tt0000004',
  tags: ['#movie'],
  listType: 'movie-tracker',
};

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

describe('import-api', () => {
  afterEach(() => {
    delete process.env.OMDB_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers import routes without endpoint rate limit overrides', async () => {
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(
      `${API_PREFIX}/import`,
      expect.not.objectContaining({ config: expect.anything() }),
      expect.any(Function)
    );
    expect(app.post).toHaveBeenCalledWith(
      `${API_PREFIX}/import/collection-items`,
      expect.not.objectContaining({ config: expect.anything() }),
      expect.any(Function)
    );
  });

  it('replaces current user exported data and preserves account data', async () => {
    insertUser('user');
    insertUser('other-user');
    const db = getDatabase();
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'access-token', '2026-01-01T00:00:00.000Z', 'vitest', null);
    db.prepare(
      'INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('user', 'tt9999999', 'library', 'Old Movie', 'old movie', '1999', '1.0', 'Old', 'old.jpg', 'old-hash');
    db.prepare(
      'INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('user', '#old', '#000000', 0, 0, 0, 1);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 1,
        userSettings: { theme: 'dark', animatedBackground: false, language: 'en' },
        collectionItems: [
          item,
          { ...item, IMDbId: 'tt0000003', listType: 'watch-later' },
          seriesTrackerItem,
          movieTrackerItem,
        ],
        tagManagement: [
          {
            tag: '#movie',
            color: '#111111',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 2,
          },
        ],
        seriesTrackerData: {
          tt0000002: {
            seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }],
            watchedEpisodes: [{ season: 1, episode: 1 }],
          },
        },
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({
      importedCollectionItems: 4,
      importedTagManagement: 1,
      importedSeriesTrackerSeasons: 1,
      importedSeriesTrackerWatchedEpisodes: 1,
    });
    expect(db.prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt9999999')).toBeUndefined();
    expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt0000003')).toEqual({
      list_type: 'watch-later',
    });
    expect(db.prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt0000004')).toEqual({
      list_type: 'movie-tracker',
    });
    expect(db.prepare('SELECT token_hash FROM access_tokens WHERE username_hash = ?').get('user')).toEqual({
      token_hash: 'access-token',
    });
    expect(
      db.prepare('SELECT theme, animated_background, language FROM user_settings WHERE username_hash = ?').get('user')
    ).toEqual({ theme: 'dark', animated_background: 0, language: 'en' });
    expect(
      db
        .prepare(
          `SELECT series_tracker_watched_episodes.season, series_tracker_watched_episodes.episode
           FROM series_tracker_watched_episodes
           INNER JOIN collection_items ON collection_items.id = series_tracker_watched_episodes.item_id
           WHERE collection_items.imdb_id = ?`
        )
        .all('tt0000002')
    ).toEqual([{ season: 1, episode: 1 }]);
  });

  it('returns 400 for an invalid full import envelope', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { type: 'wrong' } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid imported user settings', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 1,
        userSettings: { collectionListDisplayPreferences: { preferredRating: 'imdb' } },
        collectionItems: [],
        tagManagement: [],
        seriesTrackerData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate imported tag management entries', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 1,
        userSettings: {},
        collectionItems: [],
        tagManagement: [
          {
            tag: '#movie',
            color: '#111111',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 2,
          },
          {
            tag: '#movie',
            color: '#222222',
            useForImageBorder: false,
            useForTextColor: true,
            useForImageBadge: false,
            weight: 1,
          },
        ],
        seriesTrackerData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid series tracker import metadata', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 1,
        userSettings: {},
        collectionItems: [seriesTrackerItem],
        tagManagement: [],
        seriesTrackerData: {
          tt0000002: {
            seasons: [{ season: 1, episodes: 1 }],
            watchedEpisodes: [{ season: 1, episode: 2 }],
          },
        },
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('imports IMDb IDs into the library and skips existing items', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              Title: 'Fetched Movie',
              Year: '2020',
              imdbID: 'tt0000002',
              Type: 'movie',
              Poster: 'poster.jpg',
              Genre: 'Action, Adventure',
              Actors: 'Actor One',
              Plot: 'Fetched plot',
              imdbRating: '8.5',
              Ratings: [{ Source: 'Rotten Tomatoes', Value: '90%' }],
            }),
        })
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) })
    );
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      'INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'user',
      'tt0000001',
      'wishlist',
      'Existing Movie',
      'existing movie',
      '2020',
      '8.0',
      'Plot',
      'poster.jpg',
      'hash'
    );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000001 tt0000002 tt0000003 tt0000002' } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 3, importedCount: 1, skippedCount: 1, errorCount: 1 });
    expect(db.prepare('SELECT title, list_type FROM collection_items WHERE imdb_id = ?').get('tt0000002')).toEqual({
      title: 'Fetched Movie',
      list_type: 'library',
    });
    expect(db.prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt0000003')).toBeUndefined();
  });

  it('counts malformed OMDb item responses as import errors', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imdbID: 'tt0000004', Type: null, Title: 'Malformed Movie' }),
      })
    );
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000004' } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt0000004')
    ).toBeUndefined();
  });

  it('counts mismatched OMDb item IDs as import errors', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Title: 'Wrong Movie',
            Year: '2020',
            imdbID: 'tt0000006',
            Type: 'movie',
            Poster: 'poster.jpg',
            Genre: 'Action',
            Actors: 'Actor One',
            Plot: 'Fetched plot',
            imdbRating: '8.5',
            Ratings: [],
          }),
      })
    );
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000005' } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt0000006')
    ).toBeUndefined();
  });

  it('returns 400 when too many IMDb IDs are imported at once', async () => {
    const response = mockResponse();
    const source = Array.from({ length: 101 }, (_value, index) => `tt${String(index + 1).padStart(7, '0')}`).join(' ');
    const request: any = { usernameHash: 'user', body: { source } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is not a string', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: ['tt0000001'] } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is too large', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'x'.repeat(1_000_001) } };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
