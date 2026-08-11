import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';
import { replaceCollectionItemSelections, upsertShare } from '../core/database/repositories/share-repository';
import type { CollectionItemRow } from '../core/database/repositories/collection/collection-model';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (imdbId: string, tags: string[] = [], listType = 'library', usernameHash = 'user') => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
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
  const itemId = Number(result.lastInsertRowid);
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, CURRENT_TIMESTAMP)').run(
      itemId
    );
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  return itemId;
};

describe('mark-all-movies-uncompleted-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes tracking copies for own library movies', async () => {
    insertUser();
    insertItem('tt-1', ['#movie']);
    insertItem('tt-1', ['#movie'], 'tracking');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });

    const db = getDatabase();
    const trackerItem = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'tracking');
    expect(trackerItem).toBeUndefined();
  });

  it('returns 0 when no items are watched', async () => {
    insertUser();
    insertItem('tt-1', ['#movie']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('returns 0 for an empty collection', async () => {
    insertUser();

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('deletes current user tracking copies that match a readable shared library', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertItem('tt-shared', ['#movie'], 'library', 'owner');
    insertItem('tt-shared', ['#movie'], 'tracking', 'user');
    insertItem('tt-own-only', ['#movie'], 'library', 'user');
    insertItem('tt-own-only', ['#movie'], 'tracking', 'user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });

    const rows = getDatabase()
      .prepare(
        'SELECT username_hash, external_item_id, list_type FROM collection_items WHERE list_type = ? ORDER BY external_item_id'
      )
      .all('tracking');
    expect(rows).toEqual([{ username_hash: 'user', external_item_id: 'tt-own-only', list_type: 'tracking' }]);
  });

  it('returns 404 when the shared library owner is missing', async () => {
    insertUser('user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith();
  });

  it('leaves an unselected completed movie unchanged in selected mode', async () => {
    insertUser('user');
    insertUser('owner');
    const selectedItemId = insertItem('tt-selected', [], 'library', 'owner');
    insertItem('tt-hidden', [], 'library', 'owner');
    insertItem('tt-selected', [], 'tracking', 'user');
    insertItem('tt-hidden', [], 'tracking', 'user');
    upsertShare(getDatabase(), 'owner', 'user', []);
    const selectedItem = getDatabase()
      .prepare('SELECT * FROM collection_items WHERE id = ?')
      .get(selectedItemId) as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'user',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } },
      response
    );
    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare(
          "SELECT external_item_id FROM collection_items WHERE username_hash = 'user' AND list_type = 'tracking'"
        )
        .all()
    ).toEqual([{ external_item_id: 'tt-hidden' }]);
  });

  it('returns 403 when the user cannot read the shared library', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-movies-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
  });
});
