import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertShare = (ownerHash: string, sharedWithHash: string, canDelete: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, 0, 0, canDelete ? 1 : 0);
};

const insertItem = (hash = 'abc123', usernameHash = 'user') => {
  const db = getDatabase();
  insertUser(usernameHash);
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, 'tt-delete', '', '', '', '', '', '', hash);
};

const insertTypedItem = (listType: 'watch-later' | 'wishlist', hash = 'abc123', usernameHash = 'user') => {
  const db = getDatabase();
  insertUser(usernameHash);
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, 'tt-delete', listType, '', '', '', '', '', '', hash);
};

describe('delete-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when hash query param is missing', async () => {
    const request: any = { params: { imdbId: 'tt-delete' }, query: {}, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('deletes existing DB item when hash matches', async () => {
    insertItem();
    const request: any = { params: { imdbId: 'tt-delete' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase().prepare('SELECT COUNT(*) as count FROM collection_items WHERE imdb_id = ?').get('tt-delete')
    ).toEqual({ count: 0 });
  });

  it('deletes a watch later item when listType is provided', async () => {
    insertTypedItem('watch-later');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'watch-later' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase().prepare('SELECT COUNT(*) as count FROM collection_items WHERE imdb_id = ?').get('tt-delete')
    ).toEqual({ count: 0 });
  });

  it('deletes a wishlist item when listType is provided', async () => {
    insertTypedItem('wishlist');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'wishlist' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it('deletes an item from a shared library when delete permission is granted', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND imdb_id = ?')
        .get('owner', 'tt-delete')
    ).toEqual({ count: 0 });
  });

  it('returns 403 when deleting from a shared library without delete permission', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', false);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared watch later item', async () => {
    insertTypedItem('watch-later', 'abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'watch-later', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared non-library item by listType', async () => {
    insertTypedItem('watch-later', 'abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'watch-later', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared wishlist item', async () => {
    insertTypedItem('wishlist', 'abc123', 'owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { imdbId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'wishlist', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 409 when hash does not match', async () => {
    insertItem('correct-hash');
    const request: any = { params: { imdbId: 'tt-delete' }, query: { hash: 'wrong-hash' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 404 when item is not found', async () => {
    const request: any = { params: { imdbId: 'tt-missing' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
