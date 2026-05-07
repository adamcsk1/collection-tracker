import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertItem = (hash = 'abc123') => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt-delete', '', '', '', '', '', '', hash);
};

describe('delete-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when hash query param is missing', async () => {
    const request: any = { params: { imdbId: 'tt-delete' }, query: {}, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('deletes existing DB item when hash matches', async () => {
    insertItem();
    const request: any = { params: { imdbId: 'tt-delete' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase().prepare('SELECT COUNT(*) as count FROM collection_items WHERE imdb_id = ?').get('tt-delete')
    ).toEqual({ count: 0 });
  });

  it('returns 409 when hash does not match', async () => {
    insertItem('correct-hash');
    const request: any = { params: { imdbId: 'tt-delete' }, query: { hash: 'wrong-hash' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 404 when item is not found', async () => {
    const request: any = { params: { imdbId: 'tt-missing' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
