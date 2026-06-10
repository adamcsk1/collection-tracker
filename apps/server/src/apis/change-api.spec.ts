import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COMPLETED_TAG } from '@shared/constants/tags-const';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, 'tt-change', listType, 'Old', 'old', '', '', '', '', hash);
};

const updatedItem = {
  image: 'poster.jpg',
  title: 'Updated',
  genre: ['Drama'],
  IMDbId: 'tt-change',
  tags: ['#movie'],
  year: '2024',
  rate: '7.1',
  rottenTomatoesRate: '96%',
  metacriticRate: '85/100',
  userRate: 8.7,
  actors: 'Actor One, Actor Two',
  plot: 'Updated plot',
};

describe('change-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-change' }, body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when hash is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-change' }, body: { content: 'updated' }, usernameHash: 'user' };
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
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Updated', hash: hashText(JSON.stringify(updatedItem)) }),
    });
    expect(
      getDatabase()
        .prepare('SELECT title, rotten_tomatoes_rate, metacritic_rate FROM collection_items WHERE imdb_id = ?')
        .get('tt-change')
    ).toEqual({
      title: 'Updated',
      rotten_tomatoes_rate: '96%',
      metacritic_rate: '85/100',
    });
  });

  it('updates a series tracker item when listType is provided', async () => {
    insertItem('abc123', 'user', 'series-tracker');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      query: { listType: 'series-tracker' },
      body: { ...updatedItem, tags: ['#series'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        title: 'Updated',
        listType: 'series-tracker',
        tags: ['#series'],
      }),
    });
  });

  it('preserves completed tag when updating a completed series tracker item', async () => {
    insertItem('abc123', 'user', 'series-tracker');
    const db = getDatabase();
    const itemId = (db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get('tt-change') as { id: number })
      .id;
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, COMPLETED_TAG);
    db.prepare('INSERT INTO series_tracker_seasons (item_id, season, episodes) VALUES (?, ?, ?)').run(itemId, 1, 1);
    db.prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
      itemId,
      1,
      1
    );
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      query: { listType: 'series-tracker' },
      body: { ...updatedItem, tags: ['#series'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        tags: ['#completed', '#series'],
      }),
    });
  });

  it('returns 400 when updating a series tracker item with a movie type', async () => {
    insertItem('abc123', 'user', 'series-tracker');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      query: { listType: 'series-tracker' },
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
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#action'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when updating an item with a virtual tag', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#unwatched'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('updates an item in a shared library when update permission is granted', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
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
        .prepare('SELECT title FROM collection_items WHERE username_hash = ? AND imdb_id = ?')
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
      params: { imdbId: 'tt-change' },
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
    insertItem('abc123', 'owner', 'watch-later');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      query: { ownerShareCode: getUserShareCode('owner'), listType: 'watch-later' },
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
    insertItem('abc123', 'owner', 'watch-later');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
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
      params: { imdbId: 'tt-change' },
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
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#watch-later'], hash: 'abc123' },
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
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#wishlist'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 404 when a watch later item is changed to a normal item', async () => {
    insertItem('abc123', 'user', 'watch-later');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
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
      params: { imdbId: 'tt-change' },
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
    insertItem('abc123', 'user', 'watch-later');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
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
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#watch-later'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a watch later item is marked watched', async () => {
    insertItem('abc123', 'user', 'watch-later');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#watch-later', '#watched'], hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 404 when a wishlist item is marked watched', async () => {
    insertItem('abc123', 'user', 'wishlist');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, tags: ['#movie', '#wishlist', '#watched'], hash: 'abc123' },
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
      params: { imdbId: 'tt-change' },
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
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'tt-conflict', 'Conflict', 'conflict', '', '', '', '', 'hash');

    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
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
      params: { imdbId: 'tt-missing' },
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
