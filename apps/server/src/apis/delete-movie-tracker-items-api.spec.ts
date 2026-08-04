import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (usernameHash: string, imdbId: string, listType = 'finished'): number => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'imdb',
      imdbId,
      `imdb:${imdbId}`,
      listType,
      'Title',
      'title',
      '',
      '',
      '',
      `${usernameHash}-${listType}-${imdbId}`
    );
  return Number(result.lastInsertRowid);
};

describe('delete-watched-items-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes all current user movie tracker items', async () => {
    insertUser('user');
    insertUser('other-user');
    insertItem('user', 'tt-1');
    insertItem('user', 'tt-library', 'library');
    const retainedItemId = insertItem('other-user', 'tt-other');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    const rows = getDatabase()
      .prepare(
        'SELECT username_hash, external_item_id, list_type FROM collection_items ORDER BY username_hash, external_item_id'
      )
      .all();
    expect(rows).toEqual([
      { username_hash: 'other-user', external_item_id: 'tt-other', list_type: 'finished' },
      { username_hash: 'user', external_item_id: 'tt-library', list_type: 'library' },
    ]);
    expect(getDatabase().prepare('SELECT 1 FROM collection_items WHERE id = ?').get(retainedItemId)).toBeTruthy();
  });

  it('returns zero when the current user has no movie tracker items', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });
});
