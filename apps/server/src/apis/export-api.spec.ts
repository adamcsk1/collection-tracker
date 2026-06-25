import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    db.prepare(
      'INSERT INTO user_settings (username_hash, theme, animated_background, language) VALUES (?, ?, ?, ?)'
    ).run('user', 'dark', 0, 'en');
    db.prepare(
      'INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, user_rate, actors, plot, image, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'user',
      'tt123',
      'library',
      'Movie',
      'movie',
      '2020',
      '8.0',
      '90',
      '85',
      9.0,
      'Actor',
      'Plot',
      'img.jpg',
      'hash1'
    );
    db.prepare(
      'INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, user_rate, actors, plot, image, content_hash, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'user',
      'tt456',
      'series-tracker',
      'Series',
      'series',
      '2021',
      '7.5',
      '80',
      '75',
      8.0,
      'Actor',
      'Plot',
      'img2.jpg',
      'hash2',
      '2026-04-05 00:00:00'
    );
    db.prepare(
      'INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, user_rate, actors, plot, image, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'user',
      'tt789',
      'movie-tracker',
      'Tracker Movie',
      'tracker movie',
      '2022',
      '9.0',
      '95',
      '90',
      10.0,
      'Actor',
      'Plot',
      'img3.jpg',
      'hash3'
    );
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(1, '#owned');
    db.prepare(
      'INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('user', '#owned', '#111111', 1, 0, 0, 1);
    db.prepare(
      'INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles) VALUES (?, ?, ?, ?)'
    ).run(2, 1, 10, JSON.stringify(['Episode 1']));
    db.prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(2, 1, 1);

    const { register } = await import('./export-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      userSettings: {
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
      },
      collectionItems: [
        expect.objectContaining({
          IMDbId: 'tt123',
          listType: 'library',
          title: 'Movie',
          tags: ['#owned'],
        }),
        expect.objectContaining({
          IMDbId: 'tt789',
          listType: 'movie-tracker',
          title: 'Tracker Movie',
        }),
        expect.objectContaining({
          IMDbId: 'tt456',
          listType: 'series-tracker',
          title: 'Series',
          watchedAt: '2026-04-05 00:00:00',
        }),
      ],
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
      seriesTrackerData: {
        tt456: {
          seasons: [{ season: 1, episodes: 10, titles: ['Episode 1'] }],
          watchedEpisodes: [{ season: 1, episode: 1 }],
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
      userSettings: {},
      collectionItems: [],
      tagManagement: [],
      seriesTrackerData: {},
    });
  });
});
