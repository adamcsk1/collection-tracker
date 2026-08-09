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
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, 'omdb', imdbId, `omdb:${imdbId}`, 'tracking', 'movie', 'Title', 'title', '', '', '', 'hash');
  const itemId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, CURRENT_TIMESTAMP)').run(
    itemId
  );
  db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#movie');
};

const insertWatchedItemByExternalId = (
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  contentType: 'movie' | 'book' = 'movie'
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, externalProvider, externalItemId, 'tracking', contentType, 'Title', 'title', '', '', '', 'hash');
  db.prepare(
    'INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total) VALUES (?, CURRENT_TIMESTAMP, ?, ?)'
  ).run(Number(result.lastInsertRowid), contentType === 'book' ? 50 : null, contentType === 'book' ? 100 : null);
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

  it('deletes an existing tracking item', async () => {
    insertUser('user');
    insertWatchedItem('user', 'tt-1');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const item = getDatabase()
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'tracking');
    expect(item).toBeUndefined();
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('deletes all current user tracking items only', async () => {
    insertUser('user');
    insertUser('other-user');
    insertWatchedItem('user', 'tt-1');
    insertWatchedItem('user', 'tt-2');
    insertWatchedItem('other-user', 'tt-other');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-completed-movies-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 2 });
    const rows = getDatabase()
      .prepare('SELECT username_hash, external_item_id, list_type FROM collection_items ORDER BY external_item_id')
      .all();
    expect(rows).toEqual([{ username_hash: 'other-user', external_item_id: 'tt-other', list_type: 'tracking' }]);
  });

  it('returns not found when the tracking item does not exist', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('deletes an existing tracking item by external identity', async () => {
    insertUser('user');
    insertWatchedItemByExternalId('user', 'omdb', 'tt-1');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const item = getDatabase()
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'tracking');
    expect(item).toBeUndefined();
  });

  it('clears book completion and keeps the tracking twin with progress', async () => {
    insertUser('user');
    insertWatchedItemByExternalId('user', 'openlibrary', '9780306406157', 'book');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'openlibrary', externalIdentityId: '9780306406157' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    const db = getDatabase();
    const item = db
      .prepare(
        `SELECT collection_items.id, tracker_state.completed_at, tracker_state.progress_current, tracker_state.progress_total
         FROM collection_items
         INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
         WHERE collection_items.username_hash = ? AND collection_items.external_provider = ?
           AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
      )
      .get('user', 'openlibrary', '9780306406157', 'tracking') as
      | {
          id: number;
          completed_at: string | null;
          progress_current: number | null;
          progress_total: number | null;
        }
      | undefined;
    expect(item).toEqual(
      expect.objectContaining({
        completed_at: null,
        progress_current: 50,
        progress_total: 100,
      })
    );
  });

  it('deletes a canonical matching tracking item by stored external identity', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'omdb', 'tt0133093', 'imdb:tt0133093', 'tracking', 'movie', 'Title', 'title', '', '', '', 'hash');
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

    const { register } = await import('./delete-tracking-completed-item-api');
    register(app);

    await getDeleteHandler(app, `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/completed`)!(
      request,
      response
    );

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      db.prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND list_type = ?').get('user', 'tracking')
    ).toBeUndefined();
  });
});
