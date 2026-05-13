import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt001', 'Alpha', 'alpha', '1999', '8.0', 'Plot one', 'img1.jpg', 'hash1');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt002', 'Beta', 'beta', '2000', '7.5', 'Plot two', 'img2.jpg', 'hash2');
};

const insertUser = (usernameHash: string) => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (usernameHash: string, imdbId: string, title: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, title, title.toLowerCase(), '2001', '7.0', '', '', `${imdbId}-hash`);
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
});
