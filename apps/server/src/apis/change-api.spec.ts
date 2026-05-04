import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertItem = (hash = 'abc123') => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'tt-change', 'Old', 'old', '', '', '', '', hash);
};

const updatedItem = {
  image: 'poster.jpg',
  title: 'Updated',
  genre: ['Drama'],
  IMDbId: 'tt-change',
  tags: ['#movie'],
  year: 2024,
  rate: '7.1',
  actors: 'Actor One, Actor Two',
  plot: 'Updated plot',
};

describe('change-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-change' }, body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 400 when hash is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { imdbId: 'tt-change' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('updates an existing DB item when hash matches', async () => {
    insertItem();
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ title: 'Updated', hash: hashText(JSON.stringify(updatedItem)) }),
    });
    expect(getDatabase().prepare('SELECT title FROM collection_items WHERE imdb_id = ?').get('tt-change')).toEqual({
      title: 'Updated',
    });
  });

  it('returns 409 when hash does not match', async () => {
    insertItem('correct-hash');
    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, hash: 'wrong-hash' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
  });

  it('returns 409 when IMDb ID conflicts with another item', async () => {
    insertItem();
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'tt-conflict', 'Conflict', 'conflict', '', '', '', '', 'hash');

    const response = mockResponse();
    const request: any = {
      params: { imdbId: 'tt-change' },
      body: { ...updatedItem, IMDbId: 'tt-conflict', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
  });

  it('returns 404 when item is missing', async () => {
    const request: any = {
      params: { imdbId: 'tt-missing' },
      body: { ...updatedItem, hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(404);
  });
});
