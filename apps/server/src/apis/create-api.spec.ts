import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = () => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
};

const item = {
  image: 'poster.jpg',
  title: 'Custom File',
  genre: ['Drama'],
  IMDbId: 'tt0000001',
  tags: ['#movie'],
  year: 2024,
  rate: '7.1',
  actors: 'Actor One, Actor Two',
  plot: 'Plot',
};

describe('create-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('creates a DB item and returns it', async () => {
    insertUser();
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ item: expect.objectContaining({ title: 'Custom File' }) });
    expect(getDatabase().prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt0000001')).toEqual({
      title: 'Custom File',
    });
  });

  it('returns 409 when DB imdb_id already exists', async () => {
    insertUser();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'tt0000001', 'Existing', '', '', '', '', '', 'hash');
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 400 when title is invalid', async () => {
    const response = mockResponse();
    const request: any = { body: { ...item, title: '' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 500 on unexpected DB error', async () => {
    const response = mockResponse();
    const request: any = { body: item, usernameHash: 'missing-user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
