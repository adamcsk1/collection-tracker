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
