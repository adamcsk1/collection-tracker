import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertShare } from '../../test/mocks/share-mock';

const insertUserAndItem = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt001', 'imdb:tt001', 'Random Item', 'random item', '1999', 'Plot', 'img.jpg', 'hash');
};

describe('random-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns a random item', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ title: 'Random Item' }));
  });

  it('returns 404 when no items exist', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('returns only shared content covered by an exact readable grant', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'token');
    insertShare(db, 'owner', 'user', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    const insert = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, content_type, title, title_lower, year, description, image, content_hash)
       VALUES ('owner', 'omdb', ?, ?, ?, ?, ?, '', '', '', ?)`
    );
    insert.run('tt-movie', 'imdb:tt-movie', 'movie', 'Allowed Movie', 'allowed movie', 'movie-hash');
    insert.run('tt-series', 'imdb:tt-series', 'series', 'Private Series', 'private series', 'series-hash');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user' }, response);

    const { register } = await import('./random-item-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ title: 'Allowed Movie' }));
  });
});
