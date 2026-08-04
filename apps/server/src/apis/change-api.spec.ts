import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { afterEach, describe, expect, it, vi } from 'vitest';

const COMPLETED_TAG = '#completed';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertShare = (ownerHash: string, sharedWithHash: string, canUpdate: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, 0, canUpdate ? 1 : 0, 0);
};

const insertItem = (hash = 'abc123', usernameHash = 'user', listType = 'library') => {
  const db = getDatabase();
  insertUser(usernameHash);
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'omdb',
      'tt-change',
      'imdb:tt-change',
      listType,
      'Old',
      'old',
      '',
      '',
      '',
      hash,
      listType === 'tracking' ? 'series' : 'movie'
    );
  db.prepare(
    `INSERT INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, 'imdb:tt-change', 'imdb', 'tt-change', 'alias');
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      Number(result.lastInsertRowid),
      null
    );
  }
};

const updatedItem: CollectionItemChangeApiModel = {
  image: 'poster.jpg',
  title: 'Updated',
  genre: ['Drama'],
  IMDbId: 'tt-change',
  externalProvider: 'omdb',
  externalItemId: 'tt-change',
  tags: [],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One, Actor Two',
  plot: 'Updated plot',
  contentType: 'movie',
  favorite: false,
};

const updatedItemHash = getItemHash(normalizeItem(updatedItem)!);

describe('change-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: {},
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when hash is missing', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { content: 'updated' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('updates an existing DB item when hash matches', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Updated', hash: updatedItemHash }),
    });
    expect(
      getDatabase()
        .prepare(
          `SELECT collection_items.title,
             (SELECT value FROM collection_item_external_ratings WHERE item_id = collection_items.id AND source = 'rotten-tomatoes') AS rotten_tomatoes_rate,
             (SELECT value FROM collection_item_external_ratings WHERE item_id = collection_items.id AND source = 'metacritic') AS metacritic_rate
           FROM collection_items WHERE external_item_id = ?`
        )
        .get('tt-change')
    ).toEqual({
      title: 'Updated',
      rotten_tomatoes_rate: '96%',
      metacritic_rate: '85/100',
    });
  });

  it('updates an existing DB item when addressed by IMDb external identity', async () => {
    insertItem();
    getDatabase()
      .prepare('UPDATE collection_items SET canonical_item_id = ? WHERE username_hash = ? AND external_item_id = ?')
      .run('imdb:tt-change', 'user', 'tt-change');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Updated', hash: updatedItemHash }),
    });
  });

  it('returns 409 when changing provider identity to an existing item', async () => {
    insertItem();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'omdb', 'tt-other', 'imdb:tt-other', 'library', 'Other', 'other', '', '', '', 'other-hash');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, externalItemId: 'tt-other', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 409 when changing canonical identity to an existing item', async () => {
    insertItem();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'user',
        'omdb',
        'tt-conflict',
        'imdb:tt-conflict',
        'library',
        'Conflict',
        'conflict',
        '',
        '',
        '',
        'conflict-hash'
      );
    getDatabase()
      .prepare(
        `INSERT INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('user', 'imdb:tt-conflict', 'omdb', 'tt-alias', 'alias');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: {
        ...updatedItem,
        externalItemId: 'tt-alias',
        hash: 'abc123',
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('updates a series tracker item when listType is provided', async () => {
    insertItem('abc123', 'user', 'tracking');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'tracking' },
      body: { ...updatedItem, contentType: 'series', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Updated',
        listType: 'tracking',
        contentType: 'series',
        tags: [],
      }),
    });
  });

  it('updates a wishlist item when listType is provided', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'wishlist' },
      body: { ...updatedItem, tags: ['#custom'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Updated',
        listType: 'wishlist',
        tags: ['#custom'],
      }),
    });
  });

  it('updates a watch later item when listType is provided', async () => {
    insertItem('abc123', 'user', 'watchlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'watchlist' },
      body: { ...updatedItem, tags: ['#custom'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Updated',
        listType: 'watchlist',
        tags: ['#custom'],
      }),
    });
  });

  it('returns 400 when updating a watch later item as favorite', async () => {
    insertItem('abc123', 'user', 'watchlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'watchlist' },
      body: { ...updatedItem, favorite: true, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when updating a wishlist item as favorite', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'wishlist' },
      body: { ...updatedItem, favorite: true, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('preserves completed tag when updating a completed series tracker item', async () => {
    insertItem('abc123', 'user', 'tracking');
    const db = getDatabase();
    const itemId = (
      db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt-change') as { id: number }
    ).id;
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, COMPLETED_TAG);
    db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(itemId, 1, 1);
    db.prepare('INSERT INTO series_completed_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(itemId, 1, 1);
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'tracking' },
      body: { ...updatedItem, contentType: 'series', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        contentType: 'series',
        tags: [],
        watchedAt: expect.any(String),
      }),
    });
  });

  it('returns 400 when updating a series tracker item with a movie type', async () => {
    insertItem('abc123', 'user', 'tracking');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { listType: 'tracking' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when updating an item without a type tag', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, contentType: 'other', tags: ['#action'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts a former virtual tag as a custom tag when updating an item', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#unwatched'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ tags: ['#movie', '#unwatched'] }),
    });
  });

  it('accepts a former system tag name as a custom tag when updating an item', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ tags: ['#movie'] }),
    });
  });

  it('updates an item in a shared library when update permission is granted', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Updated', ownerShareCode: getUserShareCode('owner') }),
    });
    expect(
      getDatabase()
        .prepare('SELECT title FROM collection_items WHERE username_hash = ? AND external_item_id = ?')
        .get('owner', 'tt-change')
    ).toEqual({ title: 'Updated' });
  });

  it('returns 403 when updating a shared library without update permission', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', false);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when updating a shared internal collection item directly', async () => {
    insertItem('abc123', 'owner', 'watchlist');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner'), listType: 'watchlist' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 404 when updating a shared watch later item', async () => {
    insertItem('abc123', 'owner', 'watchlist');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when updating a shared wishlist item', async () => {
    insertItem('abc123', 'owner', 'wishlist');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner') },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 400 when a normal item is changed to watch later', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, contentType: 'other', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when a normal item is changed to wishlist', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, favorite: 'yes', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 when a watch later item is changed to a normal item', async () => {
    insertItem('abc123', 'user', 'watchlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a wishlist item is changed to a normal item', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a watch later item is changed to wishlist', async () => {
    insertItem('abc123', 'user', 'watchlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#wishlist'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a wishlist item is changed to watch later', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#watchlist'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a watch later item is updated without listType', async () => {
    insertItem('abc123', 'user', 'watchlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#watchlist', '#custom'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a wishlist item is updated without listType', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#wishlist', '#custom'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 409 when hash does not match', async () => {
    insertItem('correct-hash');
    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, hash: 'wrong-hash' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 409 when IMDb ID conflicts with another item', async () => {
    insertItem();
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'imdb', 'tt-conflict', 'imdb:tt-conflict', 'Conflict', 'conflict', '', '', '', 'hash');

    const response = mockResponse();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-change' },
      body: { ...updatedItem, IMDbId: 'tt-conflict', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 404 when item is missing', async () => {
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-missing' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
