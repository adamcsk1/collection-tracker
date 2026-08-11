import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';

type ContentType = 'movie' | 'series' | 'book';

interface ItemOptions {
  id: string;
  type: ContentType;
  listType?: 'library' | 'books' | 'tracking' | 'wishlist';
  owner?: string;
  canonicalId?: string;
  year?: string;
  rating?: number;
  favorite?: boolean;
  tags?: string[];
  genres?: string[];
  completedAt?: string | null;
  progressCurrent?: number | null;
}

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (options: ItemOptions): number => {
  const db = getDatabase();
  const owner = options.owner ?? 'user';
  const listType = options.listType ?? (options.type === 'book' ? 'books' : 'library');
  const provider = options.type === 'book' ? 'openlibrary' : 'imdb';
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         favorite, title, title_lower, year, user_rate, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?)`
    )
    .run(
      owner,
      provider,
      options.id,
      options.canonicalId ?? `${provider}:${options.id}`,
      listType,
      options.type,
      options.favorite ? 1 : 0,
      options.id,
      options.id.toLowerCase(),
      options.year ?? '',
      options.rating ?? null,
      `${owner}-${listType}-${options.id}`
    );
  const itemId = Number(result.lastInsertRowid);
  for (const tag of options.tags ?? []) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  for (const genre of options.genres ?? []) {
    db.prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, genre);
  }
  if (listType === 'tracking') {
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current)
       VALUES (?, ?, ?)`
    ).run(itemId, options.completedAt ?? null, options.progressCurrent ?? null);
  }
  return itemId;
};

const readStatistics = async (query: Record<string, unknown> = {}) => {
  const response = mockResponse();
  const { app, handlerPromise } = buildApp({ usernameHash: 'user', query }, response);
  const { register } = await import('./statistics-api');
  register(app);
  await handlerPromise();
  return response.send.mock.calls[0][0];
};

describe('statistics-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each(['invalid', '', ['movie']])('returns 400 for invalid media type %j', async (type) => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { type } }, response);
    const { register } = await import('./statistics-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({ error: 'Invalid media type' });
  });

  it('returns all-scope summary and scoped chart counts for the folded library', async () => {
    insertUser('user');
    insertItem({
      id: 'movie-1',
      type: 'movie',
      favorite: true,
      year: '1999',
      rating: 8.5,
      tags: ['favorite', 'shared-tag'],
      genres: ['Action'],
    });
    insertItem({
      id: 'series-1',
      type: 'series',
      year: '2001',
      rating: 7,
      tags: ['shared-tag'],
      genres: ['Drama'],
    });
    insertItem({ id: 'book-1', type: 'book', favorite: true, year: '2020', rating: 8.5, genres: ['Drama'] });
    insertItem({ id: 'ignored', type: 'movie', listType: 'wishlist', year: '2022', tags: ['ignored'] });

    expect(await readStatistics()).toEqual({
      scope: 'all',
      summary: { total: 3, movies: 1, series: 1, books: 1, favorites: 2 },
      charts: {
        tagCounts: [
          { tag: 'shared-tag', count: 2 },
          { tag: 'favorite', count: 1 },
        ],
        genreCounts: [
          { genre: 'Drama', count: 2 },
          { genre: 'Action', count: 1 },
        ],
        releaseYearCounts: [
          { year: '1999', count: 1 },
          { year: '2001', count: 1 },
          { year: '2020', count: 1 },
        ],
        userRatingCounts: [
          { rating: 7, count: 1 },
          { rating: 8, count: 2 },
        ],
        mediaTypeCounts: [
          { type: 'movie', count: 1 },
          { type: 'series', count: 1 },
          { type: 'book', count: 1 },
        ],
        statusCounts: [],
      },
    });
  });

  it('returns movie status from completed current-viewer tracking twins', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem({ id: 'movie-watched', type: 'movie', canonicalId: 'imdb:watched', favorite: true });
    insertItem({ id: 'movie-unwatched', type: 'movie' });
    insertItem({
      id: 'movie-unwatched',
      type: 'movie',
      listType: 'tracking',
      owner: 'owner',
      completedAt: '2026-01-01',
    });
    insertItem({
      id: 'different-provider-id',
      canonicalId: 'imdb:watched',
      type: 'movie',
      listType: 'tracking',
      completedAt: '2026-01-01 00:00:00',
    });

    expect(await readStatistics({ type: 'movie' })).toEqual(
      expect.objectContaining({
        scope: 'movie',
        summary: { total: 2, favorites: 1, watched: 1, unwatched: 1 },
        charts: expect.objectContaining({
          mediaTypeCounts: [],
          statusCounts: [
            { status: 'watched', count: 1 },
            { status: 'unwatched', count: 1 },
          ],
        }),
      })
    );
  });

  it('returns series tracked, completion, and in-progress counts', async () => {
    insertUser('user');
    for (const id of ['completed', 'progress', 'untracked']) insertItem({ id, type: 'series' });
    insertItem({ id: 'completed', type: 'series', listType: 'tracking', completedAt: '2026-01-01' });
    insertItem({ id: 'progress', type: 'series', listType: 'tracking' });

    expect(await readStatistics({ type: 'series' })).toEqual(
      expect.objectContaining({
        scope: 'series',
        summary: {
          total: 3,
          favorites: 0,
          tracked: 2,
          untracked: 1,
          completed: 1,
          inProgress: 1,
        },
        charts: expect.objectContaining({
          statusCounts: [
            { status: 'untracked', count: 1 },
            { status: 'completed', count: 1 },
            { status: 'inProgress', count: 1 },
          ],
        }),
      })
    );
  });

  it('keeps read, in-progress, and unread books mutually exclusive', async () => {
    insertUser('user');
    for (const id of ['read', 'progress', 'zero-progress', 'unread']) insertItem({ id, type: 'book' });
    insertItem({ id: 'read', type: 'book', listType: 'tracking', completedAt: '2026-01-01', progressCurrent: 100 });
    insertItem({ id: 'progress', type: 'book', listType: 'tracking', progressCurrent: 25 });
    insertItem({ id: 'zero-progress', type: 'book', listType: 'tracking', progressCurrent: 0 });

    expect(await readStatistics({ type: 'book' })).toEqual(
      expect.objectContaining({
        scope: 'book',
        summary: { total: 4, favorites: 0, read: 1, unread: 2, inProgress: 1 },
        charts: expect.objectContaining({
          statusCounts: [
            { status: 'read', count: 1 },
            { status: 'unread', count: 2 },
            { status: 'inProgress', count: 1 },
          ],
        }),
      })
    );
  });

  it('honors readable ownership and type scope while excluding invalid release years', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem({ id: 'mine', type: 'movie', year: '2024' });
    insertItem({ id: 'invalid-short', type: 'movie', year: '24' });
    insertItem({ id: 'invalid-text', type: 'movie', year: '202X' });
    insertItem({ id: 'mine-series', type: 'series', year: '2027' });
    insertItem({ id: 'shared', type: 'movie', owner: 'owner', year: '2025' });
    insertItem({ id: 'private-series', type: 'series', owner: 'owner', year: '2026' });
    getDatabase()
      .prepare("INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES ('owner', 'user')")
      .run();
    getDatabase()
      .prepare(
        `INSERT INTO user_share_grants
          (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
         VALUES ('owner', 'user', 'library', 'movie', 1)`
      )
      .run();

    const statistics = await readStatistics({ type: 'movie' });
    expect(statistics.summary).toEqual({ total: 4, favorites: 0, watched: 0, unwatched: 4 });
    expect(statistics.charts.releaseYearCounts).toEqual([
      { year: '2024', count: 1 },
      { year: '2025', count: 1 },
    ]);
  });
});
