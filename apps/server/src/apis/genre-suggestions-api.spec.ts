import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertShare } from '../../test/mocks/share-mock';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt001', 'imdb:tt001', 'Item', 'item', '1999', 'Plot', 'img.jpg', 'hash');
  const itemId = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt001')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, 'Action');
  db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, 'Adventure');
};

describe('genre-suggestions-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns genres matching query', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: 'act' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./genre-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        genres: expect.arrayContaining(['Action']),
      })
    );
  });

  it('returns empty array when query is empty', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./genre-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ genres: [] });
  });

  it('uses default limit of 10', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: 'a' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./genre-suggestions-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.genres.length).toBeLessThanOrEqual(10);
  });

  it('isolates shared genres by content type', async () => {
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
      },
    ]);
    const insert = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, content_type, title, title_lower, year, description, image, content_hash)
       VALUES ('owner', 'omdb', ?, ?, ?, ?, ?, '', '', '', ?)`
    );
    const movieId = Number(
      insert.run('tt-movie', 'imdb:tt-movie', 'movie', 'Movie', 'movie', 'movie-hash').lastInsertRowid
    );
    const seriesId = Number(
      insert.run('tt-series', 'imdb:tt-series', 'series', 'Series', 'series', 'series-hash').lastInsertRowid
    );
    db.prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(movieId, 'Shared Movie');
    db.prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(seriesId, 'Shared Series');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { query: 'shared' } }, response);

    const { register } = await import('./genre-suggestions-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ genres: ['Shared Movie'] });
  });
});
