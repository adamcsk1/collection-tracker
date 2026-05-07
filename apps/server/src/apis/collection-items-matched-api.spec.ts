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

describe('collection-items-matched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns matched items ordered by imdbIds', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: { imdbIds: ['tt002', 'tt001'] },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'Beta' }),
          expect.objectContaining({ title: 'Alpha' }),
        ]),
        total: 2,
      })
    );
  });

  it('returns 400 when imdbIds is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when imdbIds contains non-string values', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { imdbIds: ['tt001', 42] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns empty when no imdbIds match', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { imdbIds: [] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ items: [], total: 0 }));
  });
});
