import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';
import { replaceCollectionItemSelections, upsertShare } from '../core/database/repositories/share-repository';
import type { CollectionItemRow } from '../core/database/repositories/collection/collection-model';

const insertUser = (usernameHash = 'user') => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (hash = 'abc123', usernameHash = 'user') => {
  const db = getDatabase();
  insertUser(usernameHash);
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, 'omdb', 'tt-delete', 'omdb:tt-delete', '', '', '', '', '', hash);
};

const insertTypedItem = (listType: 'up-next' | 'wishlist' | 'tracking', hash = 'abc123', usernameHash = 'user') => {
  const db = getDatabase();
  insertUser(usernameHash);
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'omdb',
      'tt-delete',
      'omdb:tt-delete',
      listType,
      '',
      '',
      '',
      '',
      '',
      hash,
      listType === 'tracking' ? 'series' : 'movie'
    );
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(
      Number(result.lastInsertRowid),
      null
    );
  }
};

const buildRouteApp = () =>
  ({
    delete: vi.fn(),
  }) as any;

const getDeleteHandler = (app: { delete: ReturnType<typeof vi.fn> }, path: string) => {
  const call = app.delete.mock.calls.find(([routePath]) => routePath === path);
  return call?.[2] as ((request: any, response: any) => Promise<void> | void) | undefined;
};

describe('delete-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when hash query param is missing', async () => {
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: {},
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when external provider is unsupported', async () => {
    const request: any = {
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      query: { hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('deletes existing DB item when hash matches', async () => {
    insertItem();
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare('SELECT COUNT(*) as count FROM collection_items WHERE external_item_id = ?')
        .get('tt-delete')
    ).toEqual({ count: 0 });
  });

  it('deletes a watch later item when listType is provided', async () => {
    insertTypedItem('up-next');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'up-next' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare('SELECT COUNT(*) as count FROM collection_items WHERE external_item_id = ?')
        .get('tt-delete')
    ).toEqual({ count: 0 });
  });

  it('deletes a wishlist item when listType is provided', async () => {
    insertTypedItem('wishlist');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'wishlist' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it('deletes a tracking item when listType is provided', async () => {
    insertTypedItem('tracking');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'tracking' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it('deletes an item by canonical matching external identity', async () => {
    insertUser('user');
    const db = getDatabase();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'omdb', 'tt0133093', 'imdb:tt0133093', 'tracking', 'Title', 'title', '', '', '', 'abc123', 'series');
    db.prepare(
      `INSERT INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt0133093', 'imdb', 'tt0133093', 'alias');
    const request: any = {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt0133093' },
      query: { hash: 'abc123', listType: 'tracking' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const app = buildRouteApp();

    const { register } = await import('./delete-api');
    register(app);

    await getDeleteHandler(app, `${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId`)!(
      request,
      response
    );

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      db.prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND list_type = ?').get('user', 'tracking')
    ).toBeUndefined();
  });

  it('deletes an item from a shared library when delete permission is granted', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canDelete: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_item_id = ?')
        .get('owner', 'tt-delete')
    ).toEqual({ count: 0 });
  });

  it('deletes a selected item and clears its final selected grant', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    upsertShare(getDatabase(), 'owner', 'user', []);
    const selectedItem = getDatabase()
      .prepare("SELECT * FROM collection_items WHERE username_hash = 'owner' AND external_item_id = 'tt-delete'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'user',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: true },
      },
    ]);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'user',
        params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
        query: { hash: 'abc123', ownerShareCode: getUserShareCode('owner') },
      },
      response
    );
    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_shares').all()).toHaveLength(1);
  });

  it('returns 403 when deleting from a shared library without delete permission', async () => {
    insertItem('abc123', 'owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared watch later item', async () => {
    insertTypedItem('up-next', 'abc123', 'owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'up-next', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared non-library item by listType', async () => {
    insertTypedItem('up-next', 'abc123', 'owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'up-next', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when deleting a shared wishlist item', async () => {
    insertTypedItem('wishlist', 'abc123', 'owner');
    insertUser('user');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'abc123', listType: 'wishlist', ownerShareCode: getUserShareCode('owner') },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 409 when hash does not match', async () => {
    insertItem('correct-hash');
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-delete' },
      query: { hash: 'wrong-hash' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 404 when item is not found', async () => {
    const request: any = {
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-missing' },
      query: { hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
