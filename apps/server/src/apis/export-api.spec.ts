import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertItem = (
  imdbId: string,
  listType: 'library' | 'finished' | 'tracking',
  title: string,
  year: string,
  ratings: [string, string, string],
  userRate: number,
  image: string,
  contentHash: string,
  completedAt: string | null = null
): number => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, user_rate, contributors, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'user',
      'omdb',
      imdbId,
      `imdb:${imdbId}`,
      listType,
      title,
      title.toLowerCase(),
      year,
      userRate,
      'Actor',
      'Plot',
      image,
      contentHash,
      listType === 'tracking' ? 'series' : 'movie'
    );
  const itemId = Number(result.lastInsertRowid);
  const insertRating = db.prepare(
    'INSERT INTO collection_item_external_ratings (item_id, source, value) VALUES (?, ?, ?)'
  );
  insertRating.run(itemId, 'imdb', ratings[0]);
  insertRating.run(itemId, 'rotten-tomatoes', ratings[1]);
  insertRating.run(itemId, 'metacritic', ratings[2]);
  db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run('user', `imdb:${imdbId}`, 'imdb', imdbId, 'alias');
  if (listType === 'finished' || listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      itemId,
      completedAt
    );
  }
  return itemId;
};

describe('export-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns all user-owned data', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();

    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    const featurePreferences = {
      books: true,
      wishlist: false,
      watchlist: true,
      finished: false,
      tracking: true,
    };
    db.prepare(
      'INSERT INTO user_settings (username_hash, theme, animated_background, language, collection_feature_preferences) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'dark', 0, 'en', JSON.stringify(featurePreferences));
    const libraryItemId = insertItem('tt123', 'library', 'Movie', '2020', ['8.0', '90', '85'], 9, 'img.jpg', 'hash1');
    const seriesItemId = insertItem(
      'tt456',
      'tracking',
      'Series',
      '2021',
      ['7.5', '80', '75'],
      8,
      'img2.jpg',
      'hash2',
      '2026-04-05 00:00:00'
    );
    insertItem('tt789', 'finished', 'Tracker Movie', '2022', ['9.0', '95', '90'], 10, 'img3.jpg', 'hash3');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(libraryItemId, '#owned');
    db.prepare(
      'INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('user', '#owned', '#111111', 1, 0, 0, 1);
    db.prepare(
      'INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles) VALUES (?, ?, ?, ?)'
    ).run(seriesItemId, 1, 10, JSON.stringify(['Episode 1']));
    db.prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
      seriesItemId,
      1,
      1
    );

    const { register } = await import('./export-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      type: 'collection-tracker-export',
      version: 8,
      userSettings: {
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
        collectionFeaturePreferences: featurePreferences,
      },
      collectionItems: expect.arrayContaining([
        expect.objectContaining({
          IMDbId: 'tt123',
          listType: 'library',
          title: 'Movie',
          tags: ['#owned'],
          canonicalItemId: 'imdb:tt123',
          externalIds: expect.arrayContaining([
            { source: 'imdb', id: 'tt123' },
            { source: 'omdb', id: 'tt123' },
          ]),
          progressCurrent: null,
          progressTotal: null,
        }),
        expect.objectContaining({
          IMDbId: 'tt789',
          listType: 'finished',
          title: 'Tracker Movie',
          canonicalItemId: 'imdb:tt789',
          progressCurrent: null,
          progressTotal: null,
        }),
        expect.objectContaining({
          IMDbId: 'tt456',
          listType: 'tracking',
          title: 'Series',
          watchedAt: '2026-04-05 00:00:00',
          canonicalItemId: 'imdb:tt456',
          progressCurrent: null,
          progressTotal: null,
        }),
      ]),
      tagManagement: [
        {
          tag: '#owned',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      trackingData: {
        'omdb/tt456': {
          seasons: [{ season: 1, episodes: 10, titles: ['Episode 1'] }],
          completedEpisodes: [{ season: 1, episode: 1 }],
        },
      },
    });
  });

  it('returns empty data when user has no data', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'empty-user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('empty-user', 'token');

    const { register } = await import('./export-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      type: 'collection-tracker-export',
      version: 8,
      userSettings: {},
      collectionItems: [],
      tagManagement: [],
      trackingData: {},
    });
  });
});
