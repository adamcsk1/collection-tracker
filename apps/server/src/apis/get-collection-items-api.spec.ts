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
});
