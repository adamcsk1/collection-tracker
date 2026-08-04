import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertWatchedItem = (usernameHash: string, imdbId: string) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, 'omdb', imdbId, `omdb:${imdbId}`, 'watched', 'Title', 'title', '', '', '', 'hash');
  db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(
    Number(result.lastInsertRowid),
    '#movie'
  );
};

const insertWatchedItemByExternalId = (usernameHash: string, externalProvider: string, externalItemId: string) => {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, list_type, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, externalProvider, externalItemId, 'watched', 'Title', 'title', '', '', '', 'hash');
};

const buildRouteApp = () =>
  ({
    delete: vi.fn(),
  }) as any;

const getDeleteHandler = (app: { delete: ReturnType<typeof vi.fn> }, path: string) => {
  const call = app.delete.mock.calls.find(([routePath]) => routePath === path);
  return call?.[2] as ((request: any, response: any) => Promise<void> | void) | undefined;
};

describe('delete-watched-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes an existing movie tracker item', async () => {
    insertUser('user');
    insertWatchedItem('user', 'tt-1');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const item = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'watched');
    expect(item).toBeUndefined();
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('deletes all current user movie tracker items only', async () => {
    insertUser('user');
    insertUser('other-user');
    insertWatchedItem('user', 'tt-1');
    insertWatchedItem('user', 'tt-2');
    insertWatchedItem('other-user', 'tt-other');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-items-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 2 });
    const rows = getDatabase()
      .prepare('SELECT username_hash, external_item_id, list_type FROM collection_items ORDER BY external_item_id')
      .all();
    expect(rows).toEqual([{ username_hash: 'other-user', external_item_id: 'tt-other', list_type: 'watched' }]);
  });

  it('returns not found when the movie tracker item does not exist', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('deletes an existing movie tracker item by external identity', async () => {
    insertUser('user');
    insertWatchedItemByExternalId('user', 'omdb', 'tt-1');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const item = getDatabase()
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'watched');
    expect(item).toBeUndefined();
  });

  it('deletes a canonical matching movie tracker item by stored external identity', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'omdb', 'tt0133093', 'imdb:tt0133093', 'watched', 'movie', 'Title', 'title', '', '', '', 'hash');
    db.prepare(
      `INSERT INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt0133093' },
    };
    const app = buildRouteApp();

    const { register } = await import('./delete-movie-tracker-item-api');
    register(app);

    await getDeleteHandler(app, `${API_PREFIX}/watched/:externalIdentitySource/:externalIdentityId`)!(
      request,
      response
    );

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      db.prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND list_type = ?').get('user', 'watched')
    ).toBeUndefined();
  });
});
