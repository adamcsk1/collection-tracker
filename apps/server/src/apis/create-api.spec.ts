import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertShare = (ownerHash: string, sharedWithHash: string, canCreate: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, canCreate ? 1 : 0, 0, 0);
};

const item = {
  image: 'poster.jpg',
  title: 'Custom File',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  tags: ['#movie'],
  year: 2024,
  rate: '7.1',
  userRate: 8.7,
  actors: 'Actor One, Actor Two',
  plot: 'Plot',
};

describe('create-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('creates a DB item and returns it', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ title: 'Custom File' }) });
    expect(getDatabase().prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt0000001')).toEqual({
      title: 'Custom File',
    });
  });

  it('creates a watch later item using listType', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'watch-later' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Custom File', listType: 'watch-later', tags: ['#movie'] }),
    });
    expect(getDatabase().prepare('SELECT list_type FROM collection_items WHERE imdb_id = ?').get('tt0000001')).toEqual({
      list_type: 'watch-later',
    });
  });

  it('creates a wishlist item using listType', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: { ...item, listType: 'wishlist' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Custom File', listType: 'wishlist', tags: ['#movie'] }),
    });
  });

  it('creates an item in a shared library when create permission is granted', async () => {
    insertUser('owner');
    insertUser('user');
    insertShare('owner', 'user', true);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: getUserShareCode('owner') }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ title: 'Custom File' }) });
    expect(
      getDatabase()
        .prepare('SELECT title FROM collection_items WHERE username_hash = ? AND imdb_id = ?')
        .get('owner', 'tt0000001')
    ).toEqual({ title: 'Custom File' });
  });

  it('returns 403 when creating in a shared library without create permission', async () => {
    insertUser('owner');
    insertUser('user');
    insertShare('owner', 'user', false);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: getUserShareCode('owner') }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the target shared library does not exist', async () => {
    insertUser('user');
    const response = mockResponse();
    const request: any = { body: { ...item, targetOwnerShareCode: 'missing-share-code' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns 409 when DB imdb_id already exists', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'tt0000001', 'Existing', '', '', '', '', '', 'hash');
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 400 when title is invalid', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, title: '' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when watch later is combined with favorite', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, tags: ['#movie', '#watch-later', '#favorite'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when wishlist is combined with favorite', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, tags: ['#movie', '#wishlist', '#favorite'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when watch later is combined with wishlist', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, tags: ['#movie', '#watch-later', '#wishlist'] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when creating watch later in a shared library', async () => {
    const response = mockResponse();
    const request: any = {
      body: { ...item, tags: ['#movie', '#watch-later'], targetOwnerShareCode: 'shared-code' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when creating non-library listType in a shared library', async () => {
    const response = mockResponse();
    const request: any = {
      body: { ...item, listType: 'watch-later', targetOwnerShareCode: 'shared-code' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when creating wishlist in a shared library', async () => {
    const response = mockResponse();
    const request: any = {
      body: { ...item, tags: ['#movie', '#wishlist'], targetOwnerShareCode: 'shared-code' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 500 on unexpected DB error', async () => {
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'missing-user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
