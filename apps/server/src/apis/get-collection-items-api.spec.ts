import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  listType: 'watchlist' | 'wishlist' | 'tracking'
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

const insertShare = (ownerHash: string, sharedWithHash: string, canRead: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, canRead ? 1 : 0, 0, 0, 0);
};

describe('get-collection-items-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'Alpha' }),
          expect.objectContaining({ title: 'Beta' }),
        ]),
        total: 2,
        offset: 0,
        limit: 50,
      })
    );
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
        items: [expect.objectContaining({ title: 'New Item' }), expect.objectContaining({ title: 'Old Item' })],
        total: 2,
      })
    );
  });

  it('respects offset and limit', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { offset: '1', limit: '1' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        offset: 1,
        limit: 1,
      })
    );
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
        items: [expect.objectContaining({ title: 'Beta', favorite: true })],
        total: 1,
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
    expect(response.send).toHaveBeenCalledWith({ items: [], total: 0, offset: 0, limit: 50 });
  });

  it('includes items from readable shared libraries', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('user', 'tt-own', 'Own Item');
    insertItem('owner', 'tt-shared', 'Shared Item');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'Own Item', ownerShareCode: getUserShareCode('user') }),
          expect.objectContaining({ title: 'Shared Item', ownerShareCode: getUserShareCode('owner') }),
        ]),
        total: 2,
      })
    );
  });

  it('excludes shared libraries without read permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-shared', 'Shared Item');
    insertShare('owner', 'user', false);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ items: [], total: 0, offset: 0, limit: 50 });
  });

  it('excludes watch later items from the default collection list', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal', 'Normal Item');
    insertTypedItem('user', 'tt-watchlist', 'Watch Later Item', 'watchlist');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Normal Item' })],
        total: 1,
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
        items: [expect.objectContaining({ title: 'Normal Item' })],
        total: 1,
      })
    );
  });

  it('excludes series tracker items from the default collection list', async () => {
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
        items: [expect.objectContaining({ title: 'Normal Item' })],
        total: 1,
      })
    );
  });

  it('returns own watch later items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-watchlist', 'Own Watch Later Item', 'watchlist');
    insertTypedItem('owner', 'tt-shared-watchlist', 'Shared Watch Later Item', 'watchlist');
    insertShare('owner', 'user', true);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'watchlist' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Own Watch Later Item' })],
        total: 1,
      })
    );
  });

  it('returns own series tracker items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-watching', 'Own Tracked Series', 'tracking');
    insertTypedItem('owner', 'tt-shared-watching', 'Shared Tracked Series', 'tracking');
    insertShare('owner', 'user', true);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'tracking' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Own Tracked Series' })],
        total: 1,
      })
    );
  });

  it('filters series tracker items by completed status', async () => {
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
        items: [
          expect.objectContaining({
            title: 'Uncompleted Tracked Series',
          }),
        ],
        total: 1,
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
        items: [expect.objectContaining({ title: 'Library Movie' })],
        total: 1,
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
      'finished',
      'movie',
      'Canonical Tracker Movie',
      'canonical tracker movie',
      '1999',
      'Plot',
      'img.jpg',
      'tracker-hash'
    );
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { watched: 'true' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Canonical Library Movie', watched: true })],
        total: 1,
      })
    );
  });

  it('returns own watch later items when listType is provided', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('user', 'tt-library', 'Library Item');
    insertTypedItem('user', 'tt-watchlist', 'Watch Later Item', 'watchlist');
    insertTypedItem('owner', 'tt-shared-watchlist', 'Shared Watch Later Item', 'watchlist');
    insertShare('owner', 'user', true);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'watchlist' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Watch Later Item', listType: 'watchlist' })],
        total: 1,
      })
    );
  });

  it('returns own wishlist items when explicitly requested', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('user', 'tt-own-wishlist', 'Own Wishlist Item', 'wishlist');
    insertTypedItem('owner', 'tt-shared-wishlist', 'Shared Wishlist Item', 'wishlist');
    insertShare('owner', 'user', true);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'wishlist' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Own Wishlist Item' })],
        total: 1,
      })
    );
  });

  it('keeps watch later queries scoped when combined with tags', async () => {
    insertUser('user');
    insertItem('user', 'tt-normal-comedy', 'Normal Comedy Item');
    insertTypedItem('user', 'tt-watchlist-comedy', 'Watch Later Comedy Item', 'watchlist');
    insertTypedItem('user', 'tt-watchlist-drama', 'Watch Later Drama Item', 'watchlist');
    insertTag('tt-normal-comedy', 'comedy');
    insertTag('tt-watchlist-comedy', 'comedy');
    insertTag('tt-watchlist-drama', 'drama');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { listType: 'watchlist', tags: 'comedy', tagMode: 'any' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-collection-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Watch Later Comedy Item' })],
        total: 1,
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
        total: 2,
        items: expect.arrayContaining([
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
        total: 1,
        items: [expect.objectContaining({ title: 'Own Book', listType: 'books' })],
      })
    );
  });
});
