import { buildApp } from '../../test/mocks/build-app-mock';
import {
  MAX_COLLECTION_FILTER_GENRES,
  MAX_COLLECTION_FILTER_TAGS,
} from '@shared/constants/collection-filter-api-const';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt001', 'imdb:tt001', 'Alpha', 'alpha', '1999', 'Plot one', 'img1.jpg', 'hash1');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt002', 'imdb:tt002', 'Beta', 'beta', '2000', 'Plot two', 'img2.jpg', 'hash2');
};

const insertUser = (usernameHash: string) => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (usernameHash: string, imdbId: string, title: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, 'imdb', imdbId, `imdb:${imdbId}`, title, title.toLowerCase(), '2001', '', '', `${imdbId}-hash`);
};

const insertTypedItem = (
  usernameHash: string,
  imdbId: string,
  title: string,
  listType: 'up-next' | 'wishlist' | 'tracking' | 'library'
) => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'imdb',
      imdbId,
      `imdb:${imdbId}`,
      listType,
      title,
      title.toLowerCase(),
      '2001',
      '',
      '',
      `${imdbId}-hash`,
      listType === 'tracking' ? 'series' : 'movie'
    );
  if (listType === 'tracking') {
    getDatabase()
      .prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)')
      .run(Number(result.lastInsertRowid), null);
  }
};

const insertTag = (imdbId: string, tag: string) => {
  const db = getDatabase();
  const itemId = (
    db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get(imdbId) as { id: number }
  ).id;
  db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
};

describe('get-collection-items-api', () => {
  process.env.COOKIE_SECRET = 'get-items-api-secret';

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns paginated items', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ title: 'Alpha' }),
          expect.objectContaining({ title: 'Beta' }),
        ]),
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it.each(['1', '100'])('accepts collection page limit %s', async (limit) => {
    insertUser('user');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { limit } } as any, response);

    const { register } = await import('./get-collection-items-api');
    register(app);
    await handlerPromise();

    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: Number(limit), hasMore: false, nextCursor: null },
    });
  });

  it.each(['0', '-1', '1.5', '101', 'NaN', 'text', '01', '+1', ' 1 ', 1, ['1']])(
    'returns 400 for invalid collection page limit %j',
    async (limit) => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { limit } } as any, response);
      const prepareSpy = vi.spyOn(getDatabase(), 'prepare');

      const { register } = await import('./get-collection-items-api');
      register(app);
      await handlerPromise();

      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith();
      expect(prepareSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    { search: ['matrix'] },
    { tags: ['drama', 42] },
    { genres: false },
    { tagMode: 'some' },
    { type: 'podcast' },
    { favorite: true },
    { watched: 'yes' },
    { completed: ['true'] },
    { shared: 'all' },
    { listType: 'archive' },
    { orderBy: 'rating' },
    { orderDirection: 'sideways' },
    { cursor: '' },
    { cursor: 'x'.repeat(4097) },
  ])('returns 400 for malformed known filter %j', async (query) => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query } as any, response);
    const prepareSpy = vi.spyOn(getDatabase(), 'prepare');

    const { register } = await import('./get-collection-items-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith();
    expect(prepareSpy).not.toHaveBeenCalled();
  });

  it('accepts tag and genre filters at their limits', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: {
        tags: Array(MAX_COLLECTION_FILTER_TAGS).fill('tag').join(','),
        genres: Array(MAX_COLLECTION_FILTER_GENRES).fill('genre').join(','),
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });

  it.each([
    {
      tags: Array(MAX_COLLECTION_FILTER_TAGS + 1)
        .fill('tag')
        .join(','),
    },
    {
      genres: Array(MAX_COLLECTION_FILTER_GENRES + 1)
        .fill('genre')
        .join(','),
    },
  ])('returns 400 when tag or genre filters exceed their limits', async (query) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query };
    const { app, handlerPromise } = buildApp(request, response);
    const prepareSpy = vi.spyOn(getDatabase(), 'prepare');

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith();
    expect(response.send).toHaveBeenCalledTimes(1);
    expect(prepareSpy).not.toHaveBeenCalled();
  });

  it('returns newly created library items first when ordering by created date descending', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'imdb',
      'tt-old',
      'imdb:tt-old',
      'Old Item',
      'old item',
      '2001',
      '',
      '',
      'tt-old-hash',
      '2026-01-01 00:00:00'
    );
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'imdb',
      'tt-new',
      'imdb:tt-new',
      'New Item',
      'new item',
      '2002',
      '',
      '',
      'tt-new-hash',
      '2026-01-02 00:00:00'
    );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { orderBy: 'createdAt', orderDirection: 'desc' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'New Item' }), expect.objectContaining({ title: 'Old Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns cursor metadata for a limited page', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { limit: '1' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Beta' })],
        page: { limit: 1, hasMore: true, nextCursor: expect.any(String) },
      })
    );
  });

  it('returns 400 for malformed and filter-mismatched cursors', async () => {
    insertUserAndItems();
    const firstResponse = mockResponse();
    const firstRoute = buildApp(
      { usernameHash: 'user', query: { limit: '1', orderBy: 'alphabet' } } as any,
      firstResponse
    );
    const { register } = await import('./get-collection-items-api');
    register(firstRoute.app);
    await firstRoute.handlerPromise();
    const cursor = firstResponse.send.mock.calls[0][0].page.nextCursor;

    for (const invalidCursor of ['malformed', cursor]) {
      const response = mockResponse();
      const query =
        invalidCursor === cursor
          ? { limit: '1', orderBy: 'createdAt', cursor: invalidCursor }
          : { limit: '1', orderBy: 'alphabet', cursor: invalidCursor };
      const route = buildApp({ usernameHash: 'user', query } as any, response);
      register(route.app);
      await route.handlerPromise();

      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid cursor' });
    }
  });

  it('filters favorites from query parameters', async () => {
    insertUserAndItems();
    getDatabase().prepare('UPDATE collection_items SET favorite = 1 WHERE external_item_id = ?').run('tt002');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { favorite: 'true' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Beta', favorite: true })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns empty result when user has no items', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });

  it('includes items from readable shared libraries', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('user', 'tt-own', 'Own Item');
    insertItem('owner', 'tt-shared', 'Shared Item');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ title: 'Own Item', ownerShareCode: getUserShareCode('user') }),
          expect.objectContaining({ title: 'Shared Item', ownerShareCode: getUserShareCode('owner') }),
        ]),
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('excludes shared libraries without read permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-shared', 'Shared Item');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });

  it('excludes watch later items from the default collection list', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal', 'Normal Item');
    insertTypedItem('user', 'tt-watchlist', 'Watch Later Item', 'up-next');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Normal Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('excludes wishlist items from the default collection list', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal', 'Normal Item');
    insertTypedItem('user', 'tt-wishlist', 'Wishlist Item', 'wishlist');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Normal Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('excludes tracking items from the default collection list', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal', 'Normal Item');
    insertTypedItem('user', 'tt-watching', 'Tracked Series', 'tracking');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Normal Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns own watch later items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-watchlist', 'Own Watch Later Item', 'up-next');
    insertTypedItem('owner', 'tt-shared-watchlist', 'Shared Watch Later Item', 'up-next');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'up-next' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Own Watch Later Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns own tracking items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-watching', 'Own Tracked Series', 'tracking');
    insertTypedItem('owner', 'tt-shared-watching', 'Shared Tracked Series', 'tracking');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'tracking' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Own Tracked Series' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('filters tracking items by completed status', async () => {
    insertUser('user');
    insertTypedItem('user', 'tt-completed-watching', 'Completed Tracked Series', 'tracking');
    insertTypedItem('user', 'tt-uncompleted-watching', 'Uncompleted Tracked Series', 'tracking');
    getDatabase()
      .prepare(
        `UPDATE collection_item_tracker_state
         SET completed_at = ?
         WHERE item_id = (SELECT id FROM collection_items WHERE external_item_id = ?)`
      )
      .run('2026-01-01 00:00:00', 'tt-completed-watching');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'tracking', completed: 'false' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            title: 'Uncompleted Tracked Series',
          }),
        ],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('treats items without tracker state as uncompleted', async () => {
    insertUser('user');
    insertTypedItem('user', 'tt-library', 'Library Movie', 'library');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'library', completed: 'false' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Library Movie' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('filters watched library movies by canonical tracker identity', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'omdb',
      'tt0133093',
      'imdb:tt0133093',
      'library',
      'movie',
      'Canonical Library Movie',
      'canonical library movie',
      '1999',
      'Plot',
      'img.jpg',
      'library-hash'
    );
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'user',
      'omdb',
      'tt0133093',
      'imdb:tt0133093',
      'tracking',
      'movie',
      'Canonical Tracker Movie',
      'canonical tracker movie',
      '1999',
      'Plot',
      'img.jpg',
      'tracker-hash'
    );
    const trackerItemId = Number(
      (
        db
          .prepare('SELECT id FROM collection_items WHERE list_type = ? AND external_item_id = ?')
          .get('tracking', 'tt0133093')! as { id: number }
      ).id
    );
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      trackerItemId,
      '2026-03-04 00:00:00'
    );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { watched: 'true' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Canonical Library Movie', watched: true })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns own watch later items when listType is provided', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('user', 'tt-library', 'Library Item');
    insertTypedItem('user', 'tt-watchlist', 'Watch Later Item', 'up-next');
    insertTypedItem('owner', 'tt-shared-watchlist', 'Shared Watch Later Item', 'up-next');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'up-next' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Watch Later Item', listType: 'up-next' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('returns own wishlist items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-wishlist', 'Own Wishlist Item', 'wishlist');
    insertTypedItem('owner', 'tt-shared-wishlist', 'Shared Wishlist Item', 'wishlist');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'wishlist' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Own Wishlist Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('keeps watch later queries scoped when combined with tags', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal-comedy', 'Normal Comedy Item');
    insertTypedItem('user', 'tt-watchlist-comedy', 'Watch Later Comedy Item', 'up-next');
    insertTypedItem('user', 'tt-watchlist-drama', 'Watch Later Drama Item', 'up-next');
    insertTag('tt-normal-comedy', 'comedy');
    insertTag('tt-watchlist-comedy', 'comedy');
    insertTag('tt-watchlist-drama', 'drama');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'up-next', tags: 'comedy', tagMode: 'any' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ title: 'Watch Later Comedy Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it('includes own books in library All results', async () => {
    insertUser('user');
    insertItem('user', 'tt-movie', 'Library Movie');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, 'books', 'book', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'openlibrary',
        '9780140328721',
        'isbn:9780140328721',
        'Own Book',
        'own book',
        '2020',
        '',
        '',
        'book-hash'
      );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'library' } };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./get-collection-items-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        page: { limit: 50, hasMore: false, nextCursor: null },
        data: expect.arrayContaining([
          expect.objectContaining({ title: 'Library Movie', listType: 'library' }),
          expect.objectContaining({ title: 'Own Book', listType: 'books' }),
        ]),
      })
    );
  });

  it('scopes library type=book to own books only', async () => {
    insertUser('user');
    insertUser('other');
    insertItem('user', 'tt-movie', 'Library Movie');
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, 'books', 'book', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'openlibrary',
        '9780140328721',
        'isbn:9780140328721',
        'Own Book',
        'own book',
        '2020',
        '',
        '',
        'book-hash'
      );
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
           title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, 'books', 'book', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'other',
        'openlibrary',
        '9780306406157',
        'isbn:9780306406157',
        'Other Book',
        'other book',
        '2020',
        '',
        '',
        'other-book-hash'
      );

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'library', type: 'book' } };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./get-collection-items-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        page: { limit: 50, hasMore: false, nextCursor: null },
        data: [expect.objectContaining({ title: 'Own Book', listType: 'books' })],
      })
    );
  });
});
