import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const COMPLETED_TAG = '#completed';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, contributors, description, image, content_hash, content_type, favorite)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'user',
    'tt001',
    'imdb:tt001',
    'Movie One',
    'movie one',
    '1999',
    '8.0',
    'Plot one',
    'img1.jpg',
    'hash1',
    'movie',
    1
  );
  const item1Id = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt001')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item1Id, '#movie');
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item1Id, '#favorite');
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item1Id, 'sci-fi');
  db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(item1Id, 'Action');

  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'user',
    'tt001',
    'imdb:tt001',
    'finished',
    'Movie One',
    'movie one',
    '1999',
    '8.0',
    'Plot one',
    'img1.jpg',
    'hash1-watched',
    'movie'
  );
  const watchedItemId = Number(
    (
      db
        .prepare('SELECT id FROM collection_items WHERE external_item_id = ? AND list_type = ?')
        .get('tt001', 'finished')! as { id: number }
    ).id
  );
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
    watchedItemId,
    '2026-03-04 00:00:00'
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(watchedItemId, '#movie');

  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, contributors, description, image, content_hash, content_type)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'user',
    'tt002',
    'imdb:tt002',
    'Series One',
    'series one',
    '2000',
    '7.5',
    'Plot two',
    'img2.jpg',
    'hash2',
    'series'
  );
  const item2Id = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt002')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item2Id, '#series');
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item2Id, 'drama');
  db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(item2Id, 'Drama');

  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'user',
    'tt003',
    'imdb:tt003',
    'watchlist',
    'Watch Later One',
    'watch later one',
    '2001',
    '7.1',
    'Plot three',
    'img3.jpg',
    'hash3',
    'movie'
  );
  const item3Id = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt003')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item3Id, '#movie');

  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'user',
    'tt004',
    'imdb:tt004',
    'wishlist',
    'Wishlist One',
    'wishlist one',
    '2002',
    '7.2',
    'Plot four',
    'img4.jpg',
    'hash4',
    'movie'
  );
  const item4Id = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt004')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(item4Id, '#movie');
};

const insertUser = (usernameHash: string) => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertShare = (ownerHash: string, sharedWithHash: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, 0, 0, 0);
};

const insertTrackingItem = (usernameHash: string, imdbId: string, title: string) => {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
     VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    usernameHash,
    imdbId,
    `imdb:${imdbId}`,
    'tracking',
    title,
    title.toLowerCase(),
    '2001',
    '7.0',
    '',
    '',
    `${imdbId}-hash`,
    'series'
  );
  const itemId = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get(imdbId)! as { id: number }).id
  );
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, NULL)').run(itemId);
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#series');
};

describe('statistics-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns collection statistics', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 2,
        movieCount: 1,
        seriesCount: 1,
        favoriteCount: 1,
        watchlistCount: 1,
        wishlistCount: 1,
        watchedMovieCount: 1,
        watchedSeriesCount: 0,
        unwatchedMovieCount: 0,
        unwatchedLibrarySeriesCount: 1,
        unwatchedTrackerSeriesCount: 0,
        watchedYearCounts: [{ year: '2026', movieCount: 1, seriesCount: 0, count: 1 }],
        tagCounts: expect.arrayContaining([
          expect.objectContaining({ tag: 'sci-fi', count: 1 }),
          expect.objectContaining({ tag: 'drama', count: 1 }),
        ]),
        genreCounts: expect.arrayContaining([
          expect.objectContaining({ genre: 'Action', count: 1 }),
          expect.objectContaining({ genre: 'Drama', count: 1 }),
        ]),
      })
    );
  });

  it('applies filters to statistics', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { type: 'movie' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 1,
        movieCount: 1,
        seriesCount: 0,
        watchedMovieCount: 1,
        watchedSeriesCount: 0,
        unwatchedMovieCount: 0,
        unwatchedLibrarySeriesCount: 0,
        unwatchedTrackerSeriesCount: 0,
      })
    );
  });

  it('counts current user book tracker items without library book statistics', async () => {
    insertUser('user');
    const db = getDatabase();
    const insert = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, contributors, description, image, content_hash)
       VALUES ('user', 'openlibrary', ?, ?, ?, 'book', 'Book', 'book', '', '', '', '', ?)`
    );
    insert.run('9780804429573', 'isbn:9780804429573', 'books', 'books');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: {} }, response);

    const { register } = await import('./statistics-api');
    register(app);
    await handlerPromise();

    const statistics = response.send.mock.calls[0][0];
    expect(statistics).toEqual(expect.objectContaining({ booksCount: 1 }));
    expect(statistics).not.toHaveProperty('bookCount');
  });

  it('applies search filters to watched statistics', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { search: 'series' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 1,
        movieCount: 0,
        seriesCount: 1,
        watchedMovieCount: 0,
        watchedSeriesCount: 0,
        unwatchedMovieCount: 0,
        unwatchedLibrarySeriesCount: 1,
        unwatchedTrackerSeriesCount: 0,
      })
    );
  });

  it('counts tracker series correctly without listType filter', async () => {
    insertUser('user');
    insertTrackingItem('user', 'tt-series-1', 'Incomplete Series');
    insertTrackingItem('user', 'tt-series-2', 'Completed Series');
    const db = getDatabase();
    const completedItemId = Number(
      (
        db
          .prepare('SELECT id FROM collection_items WHERE external_item_id = ? AND list_type = ?')
          .get('tt-series-2', 'tracking')! as { id: number }
      ).id
    );
    db.prepare('UPDATE collection_item_tracker_state SET completed_at = ? WHERE item_id = ?').run(
      '2025-09-01 00:00:00',
      completedItemId
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        unwatchedTrackerSeriesCount: 1,
        completedTrackerSeriesCount: 1,
      })
    );
  });

  it('returns completed series in watched year statistics', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, contributors, description, image, content_hash, content_type)
       VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'tt-series',
      'imdb:tt-series',
      'Series',
      'series',
      '2024',
      '8.0',
      '',
      '',
      'library-series-hash',
      'series'
    );
    const libraryItemId = Number(
      (
        db
          .prepare('SELECT id FROM collection_items WHERE external_item_id = ? AND list_type = ?')
          .get('tt-series', 'library')! as { id: number }
      ).id
    );
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(libraryItemId, '#series');
    db.prepare(
      `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
       VALUES (?, 'imdb', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'tt-series',
      'imdb:tt-series',
      'tracking',
      'Series',
      'series',
      '2024',
      '8.0',
      '',
      '',
      'tracker-series-hash',
      'series'
    );
    const trackerItemId = Number(
      (
        db
          .prepare('SELECT id FROM collection_items WHERE external_item_id = ? AND list_type = ?')
          .get('tt-series', 'tracking')! as { id: number }
      ).id
    );
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      trackerItemId,
      '2025-09-01 00:00:00'
    );
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(trackerItemId, '#series');
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(
      trackerItemId,
      COMPLETED_TAG
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedYearCounts: [{ year: '2025', movieCount: 0, seriesCount: 1, count: 1 }],
      })
    );
  });

  it('matches watched statistics by canonical identity when IMDb ID is absent', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, contributors, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'omdb',
      'provider-library-id',
      'imdb:tt-canonical',
      'Canonical Movie',
      'canonical movie',
      '2024',
      '8.0',
      '',
      '',
      'library-movie-hash',
      'movie'
    );
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'omdb',
      'provider-tracker-id',
      'imdb:tt-canonical',
      'finished',
      'Canonical Movie',
      'canonical movie',
      '2024',
      '8.0',
      '',
      '',
      'tracker-movie-hash',
      'movie'
    );
    const trackerItemId = Number(
      (
        db
          .prepare('SELECT id FROM collection_items WHERE external_provider = ? AND external_item_id = ?')
          .get('omdb', 'provider-tracker-id')! as { id: number }
      ).id
    );
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      trackerItemId,
      '2025-01-02 00:00:00'
    );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedMovieCount: 1,
        unwatchedMovieCount: 0,
        watchedYearCounts: [{ year: '2025', movieCount: 1, seriesCount: 0, count: 1 }],
      })
    );
  });

  it('does not include shared-owner internal lists in filtered statistics', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user');
    insertTrackingItem('owner', 'tt-shared-series', 'Shared Series');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'tracking' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./statistics-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ totalItems: 0 }));
  });
});
