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
          },
          {
            listType: 'wishlist',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(`${API_PREFIX}/user/shares`, expect.anything(), expect.anything());

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
          },
          {
            listType: 'books',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
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
          },
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
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
});
