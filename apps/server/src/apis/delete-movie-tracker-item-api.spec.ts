import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertMovieTrackerItem = (usernameHash: string, imdbId: string) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, 'movie-tracker', 'Title', 'title', '', '', '', '', 'hash');
  db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(
    Number(result.lastInsertRowid),
    '#movie'
  );
};

describe('delete-movie-tracker-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes an existing movie tracker item', async () => {
    insertUser('user');
    insertMovieTrackerItem('user', 'tt-1');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const item = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'movie-tracker');
    expect(item).toBeUndefined();
  });

  it('deletes all current user movie tracker items only', async () => {
    insertUser('user');
    insertUser('other-user');
    insertMovieTrackerItem('user', 'tt-1');
    insertMovieTrackerItem('user', 'tt-2');
    insertMovieTrackerItem('other-user', 'tt-other');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 2 });
    const rows = getDatabase()
      .prepare('SELECT username_hash, imdb_id, list_type FROM collection_items ORDER BY imdb_id')
      .all();
    expect(rows).toEqual([{ username_hash: 'other-user', imdb_id: 'tt-other', list_type: 'movie-tracker' }]);
  });

  it('returns not found when the movie tracker item does not exist', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', params: { imdbId: 'tt-1' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
