import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  usernameHash: string,
  imdbId: string,
  tags: string[],
  listType = 'library',
  contentType = 'movie'
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, listType, 'Title', 'title', '', '', '', '', 'hash', contentType);
  const itemId = Number(result.lastInsertRowid);
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
};

describe('add-movie-tracker-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('copies an own library movie to the movie tracker', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#action']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' }, query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker', watched: true }),
    });
  });

  it('copies a shared library movie to the requester movie tracker', async () => {
    insertUser('owner');
    insertUser('viewer');
    insertItem('owner', 'tt-1', ['#movie']);
    getDatabase()
      .prepare(
        'INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run('owner', 'viewer', 1, 0, 0, 0);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'viewer',
      params: { imdbId: 'tt-1' },
      query: { ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker' }),
    });
    const viewerTracker = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('viewer', 'tt-1', 'movie-tracker');
    expect(viewerTracker).toBeTruthy();
  });

  it('rejects non-movie library items', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library', 'series');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' }, query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('moves an own watch later movie to the movie tracker', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#watch-later'], 'watch-later');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' }, query: { sourceListType: 'watch-later' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker' }),
    });
    const source = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'watch-later');
    expect(source).toBeUndefined();
  });

  it('removes watch later movie when it already exists in the movie tracker', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#watch-later'], 'watch-later');
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' }, query: { sourceListType: 'watch-later' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker' }),
    });
    const source = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'watch-later');
    expect(source).toBeUndefined();
  });
});
