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
     VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt001', 'imdb:tt001', 'Item', 'item', '1999', 'Plot', 'img.jpg', 'hash');
  const itemId = Number(
    (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt001')! as { id: number }).id
  );
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, 'sci-fi');
  db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, 'classic');
};

describe('tag-suggestions-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns tags matching query', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: 'sci' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining(['sci-fi']),
      })
    );
  });

  it('includes former internal tags by default', async () => {
    insertUserAndItems();
    const db = getDatabase();
    const itemId = Number(
      (db.prepare('SELECT id FROM collection_items WHERE external_item_id = ?').get('tt001')! as { id: number }).id
    );
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#movie');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '#movie' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ tags: ['#movie'] });
  });

  it('returns empty array when query is empty', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ tags: [] });
  });

  it('isolates shared tags by content type', async () => {
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
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(movieId, 'shared-movie');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(seriesId, 'shared-series');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { query: 'shared-' } }, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ tags: ['shared-movie'] });
  });
});
