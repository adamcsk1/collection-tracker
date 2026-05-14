import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItem = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt001', 'Item', 'item', '1999', '8.0', 'Plot', 'img.jpg', 'hash');
};

const insertUser = (usernameHash: string) => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (usernameHash: string, imdbId: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, 'Shared Item', 'shared item', '1999', '8.0', 'Plot', 'img.jpg', 'hash');
};

const insertShare = (ownerHash: string, sharedWithHash: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, 1, 0, 0, 0);
};

const insertTag = (imdbId: string, tag: string) => {
  const db = getDatabase();
  const itemId = (db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get(imdbId) as { id: number }).id;
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
};

describe('collection-items-exists-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns true when item exists', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt001' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true });
  });

  it('returns false when item does not exist', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt999' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: false });
  });

  it('returns true when a shared normal item exists', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-shared');
    insertShare('owner', 'user');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { imdbId: 'tt-shared', ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true });
  });

  it('returns false when a shared watch later item exists', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-watch-later');
    insertTag('tt-watch-later', '#watch-later');
    insertShare('owner', 'user');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { imdbId: 'tt-watch-later', ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: false });
  });

  it('returns 400 when imdbId is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when imdbId is empty string', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: '  ' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
