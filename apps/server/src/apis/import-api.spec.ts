import { mockResponse } from '../../test/mocks/response-mock';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metadataServiceItem, metadataServiceResponse } from '../../test/mocks/metadata-service-response-mock';
import {
  MAX_FULL_IMPORT_ACTORS_LENGTH,
  MAX_FULL_IMPORT_CANONICAL_ITEM_ID_LENGTH,
  MAX_FULL_IMPORT_COLLECTION_ITEMS,
  MAX_FULL_IMPORT_COLOR_LENGTH,
  MAX_FULL_IMPORT_COMPLETED_EPISODES,
  MAX_FULL_IMPORT_EPISODE_TITLE_LENGTH,
  MAX_FULL_IMPORT_EPISODE_TITLES,
  MAX_FULL_IMPORT_EXTERNAL_IDENTITY_ID_LENGTH,
  MAX_FULL_IMPORT_GENRE_LENGTH,
  MAX_FULL_IMPORT_HASH_LENGTH,
  MAX_FULL_IMPORT_IMAGE_LENGTH,
  MAX_FULL_IMPORT_ITEM_EXTERNAL_IDENTITIES,
  MAX_FULL_IMPORT_ITEM_GENRES,
  MAX_FULL_IMPORT_ITEM_TAGS,
  MAX_FULL_IMPORT_PLOT_LENGTH,
  MAX_FULL_IMPORT_RATING_LENGTH,
  MAX_FULL_IMPORT_SHARE_CODE_LENGTH,
  MAX_FULL_IMPORT_TAG_LENGTH,
  MAX_FULL_IMPORT_TAG_CONFIGS,
  MAX_FULL_IMPORT_TITLE_LENGTH,
  MAX_FULL_IMPORT_TRACKING_KEY_LENGTH,
  MAX_FULL_IMPORT_TRACKING_ENTRIES,
  MAX_FULL_IMPORT_TRACKING_SEASONS,
  MAX_FULL_IMPORT_YEAR_LENGTH,
} from './import-api-const';

const IMPORT_PATH = `${API_PREFIX}/users/me/imports`;
const COLLECTION_ITEMS_IMPORT_PATH = `${API_PREFIX}/collection-items/imports`;

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

const tagConfig = {
  tag: '#custom',
  color: '#111111',
  useForImageBorder: true,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 1,
};

const buildImportBody = () => ({
  type: 'collection-tracker-export',
  version: 10,
  userSettings: {},
  collectionItems: [] as unknown[],
  tagManagement: [] as unknown[],
  trackingData: {} as Record<string, unknown>,
});

const fullImportLimitCases: Array<{
  name: string;
  limit: number;
  buildBody: (count: number) => ReturnType<typeof buildImportBody>;
}> = [
  {
    name: 'collection items',
    limit: MAX_FULL_IMPORT_COLLECTION_ITEMS,
    buildBody: (count) => ({ ...buildImportBody(), collectionItems: Array(count).fill(item) }),
  },
  {
    name: 'tag configs',
    limit: MAX_FULL_IMPORT_TAG_CONFIGS,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [item, item],
      tagManagement: Array.from({ length: count }, (_value, index) => ({ ...tagConfig, tag: `#tag-${index}` })),
    }),
  },
  {
    name: 'tracking entries',
    limit: MAX_FULL_IMPORT_TRACKING_ENTRIES,
    buildBody: (count) => ({
      ...buildImportBody(),
      trackingData: Object.fromEntries(
        Array.from({ length: count }, (_value, index) => [
          `omdb/tt${String(index).padStart(7, '0')}`,
          { seasons: [], completedEpisodes: [] },
        ])
      ),
    }),
  },
  {
    name: 'genres per item',
    limit: MAX_FULL_IMPORT_ITEM_GENRES,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [{ ...item, genre: Array(count).fill('Drama') }, item],
    }),
  },
  {
    name: 'tags per item',
    limit: MAX_FULL_IMPORT_ITEM_TAGS,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [{ ...item, tags: Array(count).fill('#tag') }, item],
    }),
  },
  {
    name: 'external identities per item',
    limit: MAX_FULL_IMPORT_ITEM_EXTERNAL_IDENTITIES,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [
        {
          ...item,
          externalIds: Array.from({ length: count }, (_value, index) => ({ source: 'imdb', id: `tt${index}` })),
        },
        item,
      ],
    }),
  },
  {
    name: 'seasons per tracking entry',
    limit: MAX_FULL_IMPORT_TRACKING_SEASONS,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [watchingItem],
      trackingData: {
        'omdb/not-imported': {
          seasons: Array.from({ length: count }, (_value, index) => ({ season: index + 1, episodes: 1 })),
          completedEpisodes: [],
        },
      },
    }),
  },
  {
    name: 'episode titles per season',
    limit: MAX_FULL_IMPORT_EPISODE_TITLES,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [watchingItem],
      trackingData: {
        'omdb/not-imported': {
          seasons: [{ season: 1, episodes: 1, titles: Array(count).fill('Episode') }],
          completedEpisodes: [],
        },
      },
    }),
  },
  {
    name: 'completed episodes per tracking entry',
    limit: MAX_FULL_IMPORT_COMPLETED_EPISODES,
    buildBody: (count) => ({
      ...buildImportBody(),
      collectionItems: [watchingItem],
      trackingData: {
        'omdb/not-imported': {
          seasons: [],
          completedEpisodes: Array(count).fill({ season: 1, episode: 1 }),
        },
      },
    }),
  },
];

const stringWithPrefix = (prefix: string, length: number): string => prefix + 'x'.repeat(length - prefix.length);

const fullImportStringLimitCases: Array<{
  name: string;
  limit: number;
  buildBody: (value: string) => ReturnType<typeof buildImportBody>;
}> = [
  {
    name: 'item image',
    limit: MAX_FULL_IMPORT_IMAGE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, image: value },
        { ...item, image: value },
      ],
    }),
  },
  {
    name: 'item title',
    limit: MAX_FULL_IMPORT_TITLE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, title: value },
        { ...item, title: value },
      ],
    }),
  },
  {
    name: 'item genre',
    limit: MAX_FULL_IMPORT_GENRE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, genre: [value] },
        { ...item, genre: [value] },
      ],
    }),
  },
  {
    name: 'item tag',
    limit: MAX_FULL_IMPORT_TAG_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, tags: [value] },
        { ...item, tags: [value] },
      ],
    }),
  },
  {
    name: 'item external ID',
    limit: MAX_FULL_IMPORT_EXTERNAL_IDENTITY_ID_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, externalItemId: value },
        { ...item, externalItemId: value },
      ],
    }),
  },
  {
    name: 'additional external identity ID',
    limit: MAX_FULL_IMPORT_EXTERNAL_IDENTITY_ID_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, externalIds: [{ source: 'imdb', id: value }] },
        { ...item, externalIds: [{ source: 'imdb', id: value }] },
      ],
    }),
  },
  {
    name: 'canonical item ID',
    limit: MAX_FULL_IMPORT_CANONICAL_ITEM_ID_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, canonicalItemId: stringWithPrefix('imdb:', value.length) },
        { ...item, canonicalItemId: stringWithPrefix('imdb:', value.length) },
      ],
    }),
  },
  {
    name: 'item year',
    limit: MAX_FULL_IMPORT_YEAR_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, year: value },
        { ...item, year: value },
      ],
    }),
  },
  {
    name: 'item rating',
    limit: MAX_FULL_IMPORT_RATING_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, rate: value },
        { ...item, rate: value },
      ],
    }),
  },
  {
    name: 'item actors',
    limit: MAX_FULL_IMPORT_ACTORS_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, actors: value },
        { ...item, actors: value },
      ],
    }),
  },
  {
    name: 'item plot',
    limit: MAX_FULL_IMPORT_PLOT_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, plot: value },
        { ...item, plot: value },
      ],
    }),
  },
  {
    name: 'cached item title',
    limit: MAX_FULL_IMPORT_TITLE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, titleLower: value },
        { ...item, titleLower: value },
      ],
    }),
  },
  {
    name: 'item hash',
    limit: MAX_FULL_IMPORT_HASH_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [
        { ...item, hash: value },
        { ...item, hash: value },
      ],
    }),
  },
  {
    name: 'tag configuration tag',
    limit: MAX_FULL_IMPORT_TAG_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [item, item],
      tagManagement: [{ ...tagConfig, tag: value }],
    }),
  },
  {
    name: 'tag configuration color',
    limit: MAX_FULL_IMPORT_COLOR_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [item, item],
      tagManagement: [{ ...tagConfig, color: value }],
    }),
  },
  {
    name: 'legacy owner share code',
    limit: MAX_FULL_IMPORT_SHARE_CODE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      userSettings: { defaultLibraryOwnerShareCode: value },
      collectionItems: [item, item],
    }),
  },
  {
    name: 'owner share code',
    limit: MAX_FULL_IMPORT_SHARE_CODE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      version: 11,
      userSettings: {
        defaultCollectionOwners: [{ listType: 'library', contentType: 'movie', ownerUserShareCode: value }],
      },
      collectionItems: [item, item],
    }),
  },
  {
    name: 'episode title',
    limit: MAX_FULL_IMPORT_EPISODE_TITLE_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [watchingItem, watchingItem],
      trackingData: {
        'omdb/tt0000002': { seasons: [{ season: 1, episodes: 1, titles: [value] }], completedEpisodes: [] },
      },
    }),
  },
  {
    name: 'tracking key',
    limit: MAX_FULL_IMPORT_TRACKING_KEY_LENGTH,
    buildBody: (value) => ({
      ...buildImportBody(),
      collectionItems: [watchingItem, watchingItem],
      trackingData: { [stringWithPrefix('omdb/', value.length)]: { seasons: [], completedEpisodes: [] } },
    }),
  },
];

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
      IMPORT_PATH,
      expect.not.objectContaining({ config: expect.anything() }),
      expect.any(Function)
    );
  });

  it('registers collection item import route without endpoint rate limit overrides', async () => {
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(
      COLLECTION_ITEMS_IMPORT_PATH,
      expect.not.objectContaining({ config: expect.anything() }),
      expect.any(Function)
    );
  });

  it.each(fullImportLimitCases)('accepts exact full import $name limit', async ({ limit, buildBody }) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: buildBody(limit) };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).not.toHaveBeenCalledWith(413);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each(fullImportLimitCases)('returns 413 above full import $name limit', async ({ limit, buildBody }) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: buildBody(limit + 1) };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(413);
  });

  it.each(fullImportStringLimitCases)('accepts exact full import $name string limit', async ({ limit, buildBody }) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: buildBody('x'.repeat(limit)) };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).not.toHaveBeenCalledWith(413);
  });

  it.each(fullImportStringLimitCases)(
    'returns 413 above full import $name string limit',
    async ({ limit, buildBody }) => {
      const response = mockResponse();
      const request: any = { usernameHash: 'user', body: buildBody('x'.repeat(limit + 1)) };
      const app = buildRouteApp();

      const { register } = await import('./import-api');
      register(app);
      await getPostHandler(app, IMPORT_PATH)!(request, response);

      expect(response.code).toHaveBeenCalledWith(413);
    }
  );

  it('returns 400 for a malformed full import that also exceeds a count limit', async () => {
    const response = mockResponse();
    const collectionItems = Array(MAX_FULL_IMPORT_COLLECTION_ITEMS + 1).fill(item);
    collectionItems[0] = { ...item, genre: [1] };
    const request: any = {
      usernameHash: 'user',
      body: { ...buildImportBody(), collectionItems },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.code).not.toHaveBeenCalledWith(413);
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
        version: 10,
        userSettings: {
          theme: 'dark',
          animatedBackground: false,
          language: 'en',
          collectionFeaturePreferences: {
            wishlist: false,
            upNext: true,
            tracking: true,
            books: true,
          },
        },
        collectionItems: [
          item,
          { ...item, IMDbId: 'tt0000003', externalItemId: 'tt0000003', listType: 'up-next' },
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
          {
            ...item,
            IMDbId: undefined,
            externalProvider: 'musicbrainz',
            externalItemId: 'f509c5ff-ad54-4dde-b61e-24f750965835',
            externalIds: [{ source: 'musicbrainz', id: 'f509c5ff-ad54-4dde-b61e-24f750965835' }],
            title: 'Imported Album',
            listType: 'music',
            contentType: 'album',
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.send).toHaveBeenCalledWith({
      importedCollectionItems: 7,
      importedTagManagement: 2,
      importedTrackingSeasons: 1,
      importedTrackingCompletedEpisodes: 1,
    });
    expect(
      db.prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt9999999')
    ).toBeUndefined();
    expect(db.prepare('SELECT list_type FROM collection_items WHERE external_item_id = ?').get('tt0000003')).toEqual({
      list_type: 'up-next',
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
    expect(
      db
        .prepare(
          'SELECT external_item_id, canonical_item_id, list_type, content_type FROM collection_items WHERE external_provider = ?'
        )
        .get('musicbrainz')
    ).toEqual({
      external_item_id: 'f509c5ff-ad54-4dde-b61e-24f750965835',
      canonical_item_id: 'musicbrainz:f509c5ff-ad54-4dde-b61e-24f750965835',
      list_type: 'music',
      content_type: 'album',
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
      music: true,
      wishlist: false,
      upNext: true,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts version 9 imports and rewrites watchlist list types and prefs', async () => {
    insertUser();
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
            wishlist: true,
            watchlist: false,
            tracking: true,
            books: true,
          },
        },
        collectionItems: [{ ...item, listType: 'watchlist', IMDbId: 'tt0000999', externalItemId: 'tt0000999' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.send).toHaveBeenCalled();
    const db = getDatabase();
    expect(db.prepare('SELECT list_type FROM collection_items WHERE external_item_id = ?').get('tt0000999')).toEqual({
      list_type: 'up-next',
    });
    const importedSettings = db
      .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
      .get('user') as { collection_feature_preferences: string };
    expect(JSON.parse(importedSettings.collection_feature_preferences)).toEqual({
      books: true,
      music: true,
      wishlist: true,
      upNext: false,
      tracking: true,
    });
  });

  it.each([
    ['book in library', { contentType: 'book', listType: 'library' }],
    ['album in library', { contentType: 'album', listType: 'library' }],
    ['movie in books list', { contentType: 'movie', listType: 'books' }],
    ['movie in music list', { contentType: 'movie', listType: 'music' }],
    ['favorite in a non-library list', { favorite: true, listType: 'up-next' }],
    ['image', { image: null }],
    ['title', { title: null }],
    ['cached title', { titleLower: null }],
    ['genre', { genre: ['Drama', 1] }],
    ['IMDb id', { IMDbId: null }],
    ['external provider', { externalProvider: null }],
    ['external item id', { externalItemId: null }],
    ['external identities collection', { externalIds: 'imdb' }],
    ['external identity source', { externalIds: [{ source: 'unknown', id: 'tt1' }] }],
    ['external identity id', { externalIds: [{ source: 'imdb', id: null }] }],
    ['tags', { tags: [1] }],
    ['year', { year: 2024 }],
    ['IMDb rating', { rate: null }],
    ['Rotten Tomatoes rating', { rottenTomatoesRate: null }],
    ['Metacritic rating', { metacriticRate: null }],
    ['user rating', { userRate: '8' }],
    ['actors', { actors: null }],
    ['plot', { plot: null }],
    ['hash', { hash: null }],
    ['content type', { contentType: 'podcast' }],
    ['favorite flag', { favorite: 'true' }],
    ['list type', { listType: 'archive' }],
    ['watched timestamp', { watchedAt: 1 }],
    ['owner share code', { ownerShareCode: null }],
  ])('returns 400 for invalid imported %s', async (_caseName, itemChanges) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [{ ...item, ...itemChanges }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate canonical item identities in the same imported list', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate imported external identity aliases in the same list', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('preserves imported canonical item ids when anchored to item identities', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

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
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for external identity provider fields', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

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
          version: 10,
          userSettings: {},
          collectionItems: [{ ...item, canonicalItemId }],
          tagManagement: [],
          trackingData: {},
        },
      };
      const app = buildRouteApp();

      const { register } = await import('./import-api');
      register(app);

      await getPostHandler(app, IMPORT_PATH)!(request, response);

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
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);

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
        version: 10,
        userSettings: {},
        collectionItems: [{ ...watchedItem, watchedAt: 'not-a-date' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for calendar-invalid imported watchedAt timestamps', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [{ ...watchedItem, watchedAt: '2026-02-31 00:00:00' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '2026-01-01 24:00:00',
    '2026-01-01 00:60:00',
    '2026-01-01 00:00:60',
    '2026-01-01 00:00:00+24:00',
    '2026-01-01 00:00:00+00:60',
  ])('returns 400 for out-of-range imported watchedAt timestamp %s', async (watchedAt) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [{ ...watchedItem, watchedAt }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts date-only, fractional, and offset watched timestamps', async () => {
    insertUser('user');
    const watchedTimestamps = [
      '2026-01-01',
      '2026-01-01T01:02:03Z',
      '2026-01-01 01:02:03.1Z',
      '2026-01-01 01:02:03.12+01:30',
      '2026-01-01 01:02:03.123-01:30',
    ];
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: watchedTimestamps.map((watchedAt, index) => ({
          ...watchedItem,
          IMDbId: `tt100000${index}`,
          externalItemId: `tt100000${index}`,
          watchedAt,
        })),
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ importedCollectionItems: 5 }));
  });

  it.each([
    ['current type', { progressCurrent: '1' }],
    ['current integer', { progressCurrent: 1.5 }],
    ['current range', { progressCurrent: -1 }],
    ['total type', { progressTotal: '1' }],
    ['total integer', { progressTotal: 1.5 }],
    ['total range', { progressTotal: 0 }],
  ])('returns 400 for invalid imported progress %s', async (_caseName, progressChanges) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [{ ...watchedItem, ...progressChanges }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('clears completion state for completed series imports without tracker data', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [{ ...watchingItem, watchedAt: '2026-05-06 00:00:00' }],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, IMPORT_PATH)!(request, response);

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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid imported user settings', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: { collectionListDisplayPreferences: { preferredRating: 'imdb' } },
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    [11, { defaultLibraryOwnerShareCode: 'legacy-owner' }],
    [10, { defaultCollectionOwners: [] }],
  ])('rejects settings fields from another import version for version %s', async (version, userSettings) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version,
        userSettings,
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('imports version 11 exact-scope defaults and filters inaccessible owners', async () => {
    insertUser('user');
    insertUser('owner');
    insertUser('inaccessible-owner');
    const db = getDatabase();
    db.prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)').run(
      'owner',
      'user'
    );
    db.prepare(
      `INSERT INTO user_share_grants
       (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, can_create, scope_mode)
       VALUES ('owner', 'user', 'tracking', 'series', 1, 1, 'all')`
    ).run();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 11,
        userSettings: {
          defaultCollectionOwners: [
            {
              listType: 'tracking',
              contentType: 'series',
              ownerUserShareCode: getUserShareCode('owner'),
            },
            {
              listType: 'wishlist',
              contentType: 'movie',
              ownerUserShareCode: getUserShareCode('inaccessible-owner'),
            },
          ],
        },
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(
      db.prepare('SELECT list_type, content_type, owner_username_hash FROM collection_owner_defaults').all()
    ).toEqual([{ list_type: 'tracking', content_type: 'series', owner_username_hash: 'owner' }]);
  });

  it.each([9, 10])('converts a version %s legacy owner into valid exact-scope defaults', async (version) => {
    insertUser('user');
    insertUser('owner');
    const db = getDatabase();
    db.prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)').run(
      'owner',
      'user'
    );
    db.prepare(
      `INSERT INTO user_share_grants
       (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, can_create, scope_mode)
       VALUES ('owner', 'user', 'library', 'movie', 1, 1, 'all')`
    ).run();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version,
        userSettings: { defaultLibraryOwnerShareCode: getUserShareCode('owner') },
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(
      db.prepare('SELECT list_type, content_type, owner_username_hash FROM collection_owner_defaults').all()
    ).toEqual([{ list_type: 'library', content_type: 'movie', owner_username_hash: 'owner' }]);
  });

  it.each([
    ['non-object settings', null],
    ['unknown setting', { unknown: true }],
    ['theme type', { theme: 1 }],
    ['theme value', { theme: 'sepia' }],
    ['animated background', { animatedBackground: 'false' }],
    ['language type', { language: 1 }],
    ['language value', { language: 'xx' }],
    ['default owner type', { defaultLibraryOwnerShareCode: 1 }],
    ['blank default owner', { defaultLibraryOwnerShareCode: '   ' }],
    ['default owners type', { defaultCollectionOwners: null }],
    [
      'default owners duplicate scope',
      {
        defaultCollectionOwners: [
          { listType: 'library', contentType: 'movie', ownerUserShareCode: 'owner-one' },
          { listType: 'library', contentType: 'movie', ownerUserShareCode: 'owner-two' },
        ],
      },
    ],
    ['display preference object', { collectionListDisplayPreferences: null }],
    [
      'display year',
      {
        collectionListDisplayPreferences: {
          showYear: 'true',
          showSharedIcon: true,
          preferredRating: 'imdb',
          imdbRatingFallback: true,
        },
      },
    ],
    [
      'display shared icon',
      {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: 'true',
          preferredRating: 'imdb',
          imdbRatingFallback: true,
        },
      },
    ],
    [
      'display rating type',
      {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: true,
          preferredRating: 1,
          imdbRatingFallback: true,
        },
      },
    ],
    [
      'display rating value',
      {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: true,
          preferredRating: 'unknown',
          imdbRatingFallback: true,
        },
      },
    ],
    [
      'display IMDb fallback',
      {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: true,
          preferredRating: 'imdb',
          imdbRatingFallback: 'true',
        },
      },
    ],
  ])('returns 400 for invalid imported user setting %s', async (caseName, userSettings) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: caseName.startsWith('default owners') ? 11 : 10,
        userSettings,
        collectionItems: [],
        tagManagement: [],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for malformed imported collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {
          collectionFeaturePreferences: {
            wishlist: true,
            upNext: true,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 for duplicate imported tag management entries', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    ['entry object', null],
    ['tag', { tag: 1 }],
    ['color', { tag: '#tag', color: 1 }],
    ['image border', { tag: '#tag', color: null, useForImageBorder: 'true' }],
    ['text color', { tag: '#tag', color: null, useForImageBorder: true, useForTextColor: 'false' }],
    [
      'image badge',
      {
        tag: '#tag',
        color: null,
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: 'false',
      },
    ],
    [
      'weight type',
      {
        tag: '#tag',
        color: null,
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: '1',
      },
    ],
    [
      'finite weight',
      {
        tag: '#tag',
        color: null,
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: Number.NaN,
      },
    ],
  ])('returns 400 for invalid imported tag management %s', async (_caseName, tagManagementEntry) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [],
        tagManagement: [tagManagementEntry],
        trackingData: {},
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('imports former system tag management entries', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
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
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    ['entry object', null],
    ['seasons collection', { seasons: null, completedEpisodes: [] }],
    ['season object', { seasons: [null], completedEpisodes: [] }],
    ['season number type', { seasons: [{ season: '1', episodes: 1 }], completedEpisodes: [] }],
    ['episode count type', { seasons: [{ season: 1, episodes: '1' }], completedEpisodes: [] }],
    ['season integer', { seasons: [{ season: 1.5, episodes: 1 }], completedEpisodes: [] }],
    ['episode count integer', { seasons: [{ season: 1, episodes: 1.5 }], completedEpisodes: [] }],
    ['positive season', { seasons: [{ season: 0, episodes: 1 }], completedEpisodes: [] }],
    ['positive episode count', { seasons: [{ season: 1, episodes: 0 }], completedEpisodes: [] }],
    ['season titles', { seasons: [{ season: 1, episodes: 1, titles: [1] }], completedEpisodes: [] }],
    ['completed episodes collection', { seasons: [], completedEpisodes: null }],
    ['completed episode object', { seasons: [], completedEpisodes: [null] }],
    ['completed season type', { seasons: [], completedEpisodes: [{ season: '1', episode: 1 }] }],
    ['completed episode type', { seasons: [], completedEpisodes: [{ season: 1, episode: '1' }] }],
    ['completed season integer', { seasons: [], completedEpisodes: [{ season: 1.5, episode: 1 }] }],
    ['completed episode integer', { seasons: [], completedEpisodes: [{ season: 1, episode: 1.5 }] }],
    ['positive completed season', { seasons: [], completedEpisodes: [{ season: 0, episode: 1 }] }],
    ['positive completed episode', { seasons: [], completedEpisodes: [{ season: 1, episode: 0 }] }],
  ])('returns 400 for invalid tracking import %s', async (_caseName, trackingEntry) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
        userSettings: {},
        collectionItems: [watchingItem],
        tagManagement: [],
        trackingData: { 'omdb/tt0000002': trackingEntry },
      },
    };
    const app = buildRouteApp();

    const { register } = await import('./import-api');
    register(app);
    await getPostHandler(app, IMPORT_PATH)!(request, response);

    expect(response.code).toHaveBeenCalledWith(400);
  });

  const invalidNormalizedTrackingData: Array<
    [
      string,
      {
        key: string;
        seasons?: Array<{ season: number; episodes: number }>;
        completedEpisodes?: Array<{ season: number; episode: number }>;
      },
    ]
  > = [
    ['tracking key without separator', { key: 'omdb', completedEpisodes: [] }],
    ['tracking key without item ID', { key: 'omdb/', completedEpisodes: [] }],
    ['season above limit', { key: 'omdb/tt0000002', seasons: [{ season: 10001, episodes: 1 }] }],
    ['episode above limit', { key: 'omdb/tt0000002', seasons: [{ season: 1, episodes: 10001 }] }],
    [
      'duplicate completed episode',
      {
        key: 'omdb/tt0000002',
        seasons: [{ season: 1, episodes: 1 }],
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 1 },
        ],
      },
    ],
    [
      'completed season above limit',
      {
        key: 'omdb/tt0000002',
        seasons: [{ season: 1, episodes: 1 }],
        completedEpisodes: [{ season: 10001, episode: 1 }],
      },
    ],
    [
      'completed episode above limit',
      {
        key: 'omdb/tt0000002',
        seasons: [{ season: 1, episodes: 1 }],
        completedEpisodes: [{ season: 1, episode: 10001 }],
      },
    ],
  ];

  it.each(invalidNormalizedTrackingData)(
    'returns 400 for invalid normalized tracking data %s',
    async (_caseName, trackingChanges) => {
      const response = mockResponse();
      const key = trackingChanges.key;
      const request: any = {
        usernameHash: 'user',
        body: {
          type: 'collection-tracker-export',
          version: 10,
          userSettings: {},
          collectionItems: [watchingItem],
          tagManagement: [],
          trackingData: {
            [key]: {
              seasons: trackingChanges.seasons ?? [{ season: 1, episodes: 1 }],
              completedEpisodes: trackingChanges.completedEpisodes ?? [],
            },
          },
        },
      };
      const app = buildRouteApp();

      const { register } = await import('./import-api');
      register(app);
      await getPostHandler(app, IMPORT_PATH)!(request, response);

      expect(response.code).toHaveBeenCalledWith(400);
    }
  );

  it('returns 400 for malformed encoded tracking import keys', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        type: 'collection-tracker-export',
        version: 10,
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

    await getPostHandler(app, IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('imports IMDb IDs into the library and skips existing items', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          metadataServiceResponse(
            metadataServiceItem('tt0000002', {
              title: 'Fetched Movie',
              year: '2020',
              plot: 'Fetched plot',
              actors: 'Actor One',
              genres: ['Action', 'Adventure'],
              ratings: [
                { source: 'Internet Movie Database', value: '8.5' },
                { source: 'Rotten Tomatoes', value: '90%' },
              ],
            })
          )
        )
        .mockResolvedValueOnce(metadataServiceResponse(null, 404))
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

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);

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

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 1, errorCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts malformed OMDb item responses as import errors', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(metadataServiceResponse({ title: 'Malformed Movie' })));
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000004' } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);

    expect(response.send).toHaveBeenCalledWith({ totalCount: 1, importedCount: 0, skippedCount: 0, errorCount: 1 });
    expect(
      getDatabase().prepare('SELECT title FROM collection_items WHERE external_item_id = ?').get('tt0000004')
    ).toBeUndefined();
  });

  it('counts mismatched OMDb item IDs as import errors', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        metadataServiceResponse(
          metadataServiceItem('tt0000006', {
            title: 'Wrong Movie',
            year: '2020',
            plot: 'Fetched plot',
            actors: 'Actor One',
            genres: ['Action'],
            ratings: [{ source: 'Internet Movie Database', value: '8.5' }],
          })
        )
      )
    );
    insertUser('user');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'tt0000005' } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);

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

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is not a string', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: ['tt0000001'] } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when the IMDb ID import source is too large', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { source: 'x'.repeat(1_000_001) } };
    const app = buildRouteApp();

    const { register } = await import('./import-collection-items-api');
    register(app);

    await getPostHandler(app, COLLECTION_ITEMS_IMPORT_PATH)!(request, response);
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
