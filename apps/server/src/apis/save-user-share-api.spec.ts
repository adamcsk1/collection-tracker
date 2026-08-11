import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare } from '../../test/mocks/share-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const insertUser = (usernameHash: string, username: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, username);
};

describe('save-user-share-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates a share from grants and implies read permission', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: false,
            canCreate: true,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'wishlist',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(`${API_PREFIX}/users/me/shares`, expect.anything(), expect.anything());

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare(
          `SELECT list_type, content_type, can_read, can_create, can_update, can_delete
           FROM user_share_grants
           WHERE owner_username_hash = ? AND shared_with_username_hash = ?
           ORDER BY list_type, content_type`
        )
        .all('owner-hash', 'friend-hash')
    ).toEqual([
      {
        list_type: 'library',
        content_type: 'movie',
        can_read: 1,
        can_create: 1,
        can_update: 0,
        can_delete: 0,
      },
      {
        list_type: 'wishlist',
        content_type: 'series',
        can_read: 1,
        can_create: 0,
        can_update: 0,
        can_delete: 0,
      },
    ]);
  });

  it('updates an existing outgoing share grants', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    insertLibraryShare(getDatabase(), 'owner-hash', 'friend-hash', { canRead: true });

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            readMode: 'all',
          },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare(
          `SELECT list_type, content_type, can_read, can_create, can_update, can_delete
           FROM user_share_grants
           WHERE owner_username_hash = ? AND shared_with_username_hash = ?`
        )
        .all('owner-hash', 'friend-hash')
    ).toEqual([
      {
        list_type: 'library',
        content_type: 'movie',
        can_read: 1,
        can_create: 1,
        can_update: 1,
        can_delete: 1,
      },
    ]);
  });

  it('removes an omitted selected scope and preserves the relationship', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner-hash', 'friend-hash');
    getDatabase()
      .prepare(
        `INSERT INTO user_share_grants
         (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, scope_mode)
         VALUES (?, ?, 'library', 'movie', 1, 'selected')`
      )
      .run('owner-hash', 'friend-hash');
    const itemResult = getDatabase()
      .prepare(
        `INSERT INTO collection_items
         (username_hash, external_provider, external_item_id, list_type, content_type,
          title, title_lower, year, contributors, description, image, content_hash)
         VALUES ('owner-hash', 'imdb', 'selected', 'library', 'movie', 'Selected', 'selected', '', '', '', '', 'h')`
      )
      .run();
    getDatabase()
      .prepare(
        `INSERT INTO user_share_item_selections
         (owner_username_hash, shared_with_username_hash, collection_item_id) VALUES (?, ?, ?)`
      )
      .run('owner-hash', 'friend-hash', Number(itemResult.lastInsertRowid));
    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        grants: [],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_shares').all()).toHaveLength(1);
  });

  it('preserves selections when saving an unchanged selected scope and updates permissions', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner-hash', 'friend-hash');
    getDatabase()
      .prepare(
        `INSERT INTO user_share_grants
         (owner_username_hash, shared_with_username_hash, list_type, content_type,
          can_read, can_create, can_update, can_delete, scope_mode)
         VALUES (?, ?, 'books', 'book', 1, 0, 0, 0, 'selected')`
      )
      .run('owner-hash', 'friend-hash');
    const itemResult = getDatabase()
      .prepare(
        `INSERT INTO collection_items
         (username_hash, external_provider, external_item_id, list_type, content_type,
          title, title_lower, year, contributors, description, image, content_hash)
         VALUES ('owner-hash', 'openlibrary', 'book', 'books', 'book', 'Book', 'book', '', '', '', '', 'book')`
      )
      .run();
    const itemId = Number(itemResult.lastInsertRowid);
    getDatabase()
      .prepare(
        `INSERT INTO user_share_item_selections
         (owner_username_hash, shared_with_username_hash, collection_item_id) VALUES (?, ?, ?)`
      )
      .run('owner-hash', 'friend-hash', itemId);
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'owner-hash',
        body: {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          grants: [
            {
              listType: 'books',
              contentType: 'book',
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
              readMode: 'selected',
            },
          ],
        },
      },
      response
    );
    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT collection_item_id FROM user_share_item_selections').all()).toEqual([
      { collection_item_id: itemId },
    ]);
    expect(
      getDatabase().prepare('SELECT can_create, can_update, can_delete, scope_mode FROM user_share_grants').get()
    ).toEqual({ can_create: 1, can_update: 1, can_delete: 1, scope_mode: 'selected' });
  });

  it('accepts an empty grant array and preserves the relationship', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    insertLibraryShare(getDatabase(), 'owner-hash', 'friend-hash', { canRead: true });
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'owner-hash',
        body: { sharedWithUserShareCode: getUserShareCode('friend-hash'), grants: [] },
      },
      response
    );
    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_shares').all()).toHaveLength(1);
  });

  it('rejects missing grants', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        canRead: true,
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([undefined, 'none'])('rejects grant read mode %s', async (readMode) => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'owner-hash',
        body: {
          sharedWithUserShareCode: 'code',
          grants: [
            {
              listType: 'library',
              contentType: 'movie',
              canRead: true,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              ...(readMode === undefined ? {} : { readMode }),
            },
          ],
        },
      },
      response
    );
    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects invalid scopes instead of dropping them', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'books',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_shares').all()).toEqual([]);
  });

  it('rejects duplicate scopes instead of keeping the last grant', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            readMode: 'all',
          },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_shares').all()).toEqual([]);
  });

  it.each([
    {
      sharedWithUserShareCode: 'code',
      grants: [],
      unexpected: true,
    },
    {
      sharedWithUserShareCode: 'code',
      grants: [
        {
          listType: 'library',
          contentType: 'movie',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          readMode: 'all',
          unexpected: true,
        },
      ],
    },
  ])('rejects malformed payload properties', async (body) => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'owner-hash', body }, response);
    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });
});
