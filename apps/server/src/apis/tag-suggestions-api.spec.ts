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
  ).run('user', 'tt001', 'Item', 'item', '1999', '8.0', 'Plot', 'img.jpg', 'hash');
  const itemId = Number(db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get('tt001')!.id);
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

  it('excludes internal tags by default', async () => {
    insertUserAndItems();
    const db = getDatabase();
    const itemId = Number(db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get('tt001')!.id);
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#movie');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '#movie' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ tags: [] });
  });

  it('includes internal tags when requested', async () => {
    insertUserAndItems();
    const db = getDatabase();
    const itemId = Number(db.prepare('SELECT id FROM collection_items WHERE imdb_id = ?').get('tt001')!.id);
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#movie');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '#movie', includeInternal: 'true' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./tag-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining(['#movie']),
      })
    );
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
});
