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
  externalProvider: 'omdb',
  externalItemId: 'tt0000001',
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
  watchedAt: null,
  contentType: 'movie',
  favorite: false,
};

const watchingItem = {
  ...item,
  title: 'Imported Series',
  titleLower: 'imported series',
  IMDbId: 'tt0000002',
  externalItemId: 'tt0000002',
  tags: ['#completed', '#series'],
  listType: 'tracking',
  watchedAt: '2026-05-06 00:00:00',
  contentType: 'series',
};

const watchedItem = {
  ...item,
  title: 'Imported Tracker Movie',
  titleLower: 'imported tracker movie',
  IMDbId: 'tt0000004',
  externalItemId: 'tt0000004',
  tags: ['#movie'],
  listType: 'tracking',
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
  });

  it('registers collection item import route without endpoint rate limit overrides', async () => {
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

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
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'imdb',
      'tt9999999',
      'imdb:tt9999999',
      'library',
      'Old Movie',
      'old movie',
      '1999',
      'Old',
      'old.jpg',
      'old-hash'
    );
    db.prepare(
      'INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('user', '#old', '#000000', 0, 0, 0, 1);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {
          theme: 'dark',
          animatedBackground: false,
          language: 'en',
          collectionFeaturePreferences: {
            wishlist: false,
            watchlist: true,
            tracking: true,
            books: true,
          },
        },
        collectionItems: [
          item,
          { ...item, IMDbId: 'tt0000003', externalItemId: 'tt0000003', listType: 'watchlist' },
          {
            ...item,
            IMDbId: undefined,
            externalProvider: 'omdb',
            externalItemId: 'tt0000123',
            title: 'Provider Movie',
          },
          watchingItem,
          watchedItem,
          {
            ...item,
            IMDbId: undefined,
            externalProvider: 'openlibrary',
            externalItemId: '0-306-40615-2',
            externalIds: [{ source: 'isbn', id: '978-0-306-40615-7' }],
            title: 'Imported Book',
            listType: 'books',
            contentType: 'book',
          },
        ],
        tagManagement: [
          {
            tag: '#favorite',
            color: '#222222',
            useForImageBorder: false,
            useForTextColor: true,
            useForImageBadge: false,
            weight: 3,
          },
          {
            tag: '#custom',
            color: '#111111',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 2,
          },
        ],
        trackingData: {
          'omdb/tt0000002': {
            seasons: [{ season: 1, episodes: 1, titles: ['Pilot'] }],
            completedEpisodes: [{ season: 1, episode: 1 }],
          },
        },
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({
      importedCollectionItems: 6,
      importedTagManagement: 2,
      importedTrackingSeasons: 1,
      importedTrackingCompletedEpisodes: 1,
    });
    expect(
      db.prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt9999999')
    ).toBeUndefined();
    expect(db.prepare('SELECT list_type FROM collection_items WHERE external_item_id = ?').get('tt0000003')).toEqual({
      list_type: 'watchlist',
    });
    expect(db.prepare('SELECT list_type FROM collection_items WHERE external_item_id = ?').get('tt0000004')).toEqual({
      list_type: 'tracking',
    });
    expect(
      db
        .prepare('SELECT external_item_id FROM collection_items WHERE external_provider = ? AND external_item_id = ?')
        .get('omdb', 'tt0000123')
    ).toEqual({ external_item_id: 'tt0000123' });
    expect(
      db
        .prepare(
          'SELECT external_item_id, canonical_item_id, list_type, content_type FROM collection_items WHERE external_provider = ?'
        )
        .get('openlibrary')
    ).toEqual({
      external_item_id: '9780306406157',
      canonical_item_id: 'isbn:9780306406157',
      list_type: 'books',
      content_type: 'book',
    });
    expect(db.prepare('SELECT token_hash FROM access_tokens WHERE username_hash = ?').get('user')).toEqual({
      token_hash: 'access-token',
    });
    expect(
      db
        .prepare(
          'SELECT theme, animated_background, language, collection_feature_preferences FROM user_settings WHERE username_hash = ?'
        )
        .get('user')
    ).toEqual(
      expect.objectContaining({
        theme: 'dark',
        animated_background: 0,
        language: 'en',
      })
    );
    const importedSettings = db
      .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
      .get('user') as { collection_feature_preferences: string };
    expect(JSON.parse(importedSettings.collection_feature_preferences)).toEqual({
      books: true,
      wishlist: false,
      watchlist: true,
      tracking: true,
    });
    expect(
      db
        .prepare(
          `SELECT series_completed_episodes.season, series_completed_episodes.episode
           FROM series_completed_episodes
           INNER JOIN collection_items ON collection_items.id = series_completed_episodes.item_id
            WHERE collection_items.external_item_id = ?`
        )
        .all('tt0000002')
    ).toEqual([{ season: 1, episode: 1 }]);
    expect(
      db
        .prepare(
          `SELECT tracker_state.completed_at
           FROM collection_item_tracker_state tracker_state
           INNER JOIN collection_items ON collection_items.id = tracker_state.item_id
           WHERE collection_items.external_item_id = ?`
        )
        .get('tt0000002')
    ).toEqual({ completed_at: '2026-05-06 00:00:00' });
  });

  it('returns 400 for unsupported full import versions', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 2,
        userSettings: {},
        collectionItems: [item],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    ['book in library', { contentType: 'book', listType: 'library' }],
    ['movie in books list', { contentType: 'movie', listType: 'books' }],
    ['favorite in a non-library list', { favorite: true, listType: 'watchlist' }],
  ])('returns 400 for invalid imported %s', async (_caseName, itemChanges) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [{ ...item, ...itemChanges }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate canonical item identities in the same imported list', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [
          item,
          {
            ...item,
            IMDbId: undefined,
            externalProvider: 'tmdb',
            externalItemId: '603',
            externalIds: [{ source: 'imdb', id: 'tt0000001' }],
          },
        ],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate imported external identity aliases in the same list', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [
          {
            ...item,
            IMDbId: undefined,
            externalItemId: 'provider-a',
            externalIds: [{ source: 'imdb', id: 'tt0000001' }],
          },
          {
            ...item,
            IMDbId: undefined,
            externalItemId: 'provider-b',
            externalIds: [
              { source: 'imdb', id: 'tt0000002' },
              { source: 'omdb', id: 'provider-a' },
            ],
          },
        ],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('preserves imported canonical item ids when anchored to item identities', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [
          {
            ...item,
            IMDbId: undefined,
            externalProvider: 'omdb',
            externalItemId: 'provider-a',
            canonicalItemId: 'omdb:provider-a',
            externalIds: [{ source: 'omdb', id: 'provider-current' }],
          },
        ],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ importedCollectionItems: 1 }));
    expect(
      getDatabase().prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ?').get('user')
    ).toEqual({ canonical_item_id: 'omdb:provider-a' });
    expect(
      getDatabase()
        .prepare(
          'SELECT external_provider, external_item_id, canonical_item_id FROM external_item_identities WHERE username_hash = ? AND external_provider = ? AND external_item_id = ?'
        )
        .get('user', 'omdb', 'provider-current')
    ).toEqual({
      external_provider: 'omdb',
      external_item_id: 'provider-current',
      canonical_item_id: 'omdb:provider-a',
    });
  });

  it('returns 400 for canonical item ids not anchored to item identities', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [
          {
            ...item,
            IMDbId: undefined,
            externalItemId: 'provider-a',
            canonicalItemId: 'imdb:tt9999999',
            externalIds: [{ source: 'omdb', id: 'provider-current' }],
          },
        ],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for legacy export version 5', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 5,
        userSettings: {},
        collectionItems: [item],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for external identity provider fields', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [
          {
            ...item,
            externalIds: [{ provider: 'omdb', id: 'provider-field' }],
          },
        ],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each(['', '   ', 'not-a-canonical', 'omdb:', ':tt1', ' unknown:tt1'])(
    'returns 400 for invalid imported canonical item id %j',
    async (canonicalItemId) => {
      insertUser('user');
      const response = mockResponse();
      const request: any = {
        usernameHash: 'user',
        body: {
          type: 'collection-tracker-export',
          version: 9,
          userSettings: {},
          collectionItems: [{ ...item, canonicalItemId }],
          tagManagement: [],
          trackingData: {},
        },
      };
      const app = buildRouteApp();

      const { register } = await import('./import-api');
      register(app);

      await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

      expect(response.code).toHaveBeenCalledWith(400);
    }
  );

  it('clears completion state for imported incomplete series even when a timestamp is present', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [{ ...watchingItem, tags: ['#series'], watchedAt: '2026-05-06 00:00:00' }],
        tagManagement: [],
        trackingData: {
          'omdb/tt0000002': {
            seasons: [{ season: 1, episodes: 2 }],
            completedEpisodes: [{ season: 1, episode: 1 }],
          },
        },
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ importedCollectionItems: 1 }));
    expect(
      getDatabase()
        .prepare(
          `SELECT tracker_state.completed_at
           FROM collection_item_tracker_state tracker_state
           INNER JOIN collection_items ON collection_items.id = tracker_state.item_id
           WHERE collection_items.external_item_id = ?`
        )
        .get('tt0000002')
    ).toEqual({ completed_at: null });
  });

  it('returns 400 for invalid imported watchedAt timestamps', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [{ ...watchedItem, watchedAt: 'not-a-date' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for calendar-invalid imported watchedAt timestamps', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [{ ...watchedItem, watchedAt: '2026-02-31 00:00:00' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('clears completion state for completed series imports without tracker data', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [{ ...watchingItem, watchedAt: '2026-05-06 00:00:00' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ importedCollectionItems: 1 }));
    expect(
      getDatabase()
        .prepare(
          `SELECT tracker_state.completed_at
           FROM collection_item_tracker_state tracker_state
           INNER JOIN collection_items ON collection_items.id = tracker_state.item_id
           WHERE collection_items.external_item_id = ?`
        )
        .get('tt0000002')
    ).toEqual({ completed_at: null });
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
        version: 9,
        userSettings: { collectionListDisplayPreferences: { preferredRating: 'imdb' } },
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for malformed imported collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {
          collectionFeaturePreferences: {
            wishlist: true,
            watchlist: true,
            tracking: true,
          },
        },
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
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
        version: 9,
        userSettings: {},
        collectionItems: [],
        tagManagement: [
          {
            tag: '#custom',
            color: '#111111',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 2,
          },
          {
            tag: '#custom',
            color: '#222222',
            useForImageBorder: false,
            useForTextColor: true,
            useForImageBadge: false,
            weight: 1,
          },
        ],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('imports former system tag management entries', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: { theme: 'dark', animatedBackground: false, language: 'en' },
        collectionItems: [],
        tagManagement: [
          {
            tag: '#favorite',
            color: '#111111',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 2,
          },
        ],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import`)!(request, response);
    expect(response.send).toHaveBeenCalledWith({
      importedCollectionItems: 0,
      importedTagManagement: 1,
      importedTrackingSeasons: 0,
      importedTrackingCompletedEpisodes: 0,
    });
    expect(getDatabase().prepare('SELECT tag FROM tag_configs WHERE username_hash = ?').all('user')).toEqual([
      { tag: '#favorite' },
    ]);
  });

  it('returns 400 for invalid tracking import metadata', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [watchingItem],
        tagManagement: [],
        trackingData: {
          'omdb/tt0000002': {
            seasons: [{ season: 1, episodes: 1 }],
            completedEpisodes: [{ season: 1, episode: 2 }],
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

  it('returns 400 for malformed encoded tracking import keys', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 9,
        userSettings: {},
        collectionItems: [watchingItem],
        tagManagement: [],
        trackingData: {
          'omdb/%E0%A4%A': {
            seasons: [{ season: 1, episodes: 1 }],
            completedEpisodes: [],
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
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'imdb',
      'tt0000001',
      'imdb:tt0000001',
      'wishlist',
      'Existing Movie',
      'existing movie',
      '2020',
      'Plot',
      'poster.jpg',
      'hash'
    );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000001 tt0000002 tt0000003 tt0000002' } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 3, importedCount: 1, skippedCount: 1, errorCount: 1 });
    expect(
      db.prepare('SELECT title, list_type FROM collection_items WHERE external_item_id = ?').get('tt0000002')
    ).toEqual({
      title: 'Fetched Movie',
      list_type: 'library',
    });
    expect(
      db.prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt0000003')
    ).toBeUndefined();
  });

  it('skips IMDb ID imports when a canonical equivalent already exists under another provider', async () => {
    process.env.OMDB_API_KEY = 'key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    insertUser('user');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        'tt0000002',
        'imdb:tt0000002',
        'Existing Movie',
        'existing movie',
        '2020',
        'Plot',
        'poster.jpg',
        'hash'
      );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000002' } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 1, errorCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
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

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt0000004')
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

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt0000006')
    ).toBeUndefined();
  });

  it('returns 400 when too many IMDb IDs are imported at once', async () => {
    const response = mockResponse();
    const source = Array.from({ length: 101 }, (_value, index) => `tt${String(index + 1).padStart(7, '0')}`).join(' ');
    const request: any = { usernameHash: 'user', body: { source } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is not a string', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: ['tt0000001'] } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is too large', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'x'.repeat(1_000_001) } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, `${API_PREFIX}/import/collection-items`)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
