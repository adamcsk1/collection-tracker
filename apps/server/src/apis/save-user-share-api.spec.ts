import { API_PREFIX } from '@shared/constants/api-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
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

  it('creates a share from a short share code and implies read permission', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        canRead: false,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
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
          'SELECT can_read, can_create, can_update, can_delete FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?'
        )
        .get('owner-hash', 'friend-hash')
    ).toEqual({ can_read: 1, can_create: 1, can_update: 0, can_delete: 0 });
  });

  it('updates an existing outgoing share permissions', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    getDatabase()
      .prepare(
        `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('owner-hash', 'friend-hash', 1, 0, 0, 0);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: {
        sharedWithUserShareCode: getUserShareCode('friend-hash'),
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 1 });
    expect(
      getDatabase()
        .prepare('SELECT can_read, can_create, can_update, can_delete FROM user_shares WHERE owner_username_hash = ?')
        .get('owner-hash')
    ).toEqual({ can_read: 1, can_create: 1, can_update: 1, can_delete: 1 });
  });

  it('rejects missing and unknown target share codes', async () => {
    insertUser('owner-hash', 'Owner');
    const missingResponse = mockResponse();
    const missingRequest: any = { usernameHash: 'owner-hash', body: { sharedWithUserShareCode: ' ' } };
    const { app: missingApp, handlerPromise: missingHandlerPromise } = buildApp(missingRequest, missingResponse);

    const { register } = await import('./save-user-share-api');
    register(missingApp);

    await missingHandlerPromise();
    expect(missingResponse.code).toHaveBeenCalledWith(400);

    const unknownResponse = mockResponse();
    const unknownRequest: any = {
      usernameHash: 'owner-hash',
      body: { sharedWithUserShareCode: 'unknown-share-code' },
    };
    const { app: unknownApp, handlerPromise: unknownHandlerPromise } = buildApp(unknownRequest, unknownResponse);

    register(unknownApp);

    await unknownHandlerPromise();
    expect(unknownResponse.code).toHaveBeenCalledWith(404);
  });

  it('does not allow sharing with the current user', async () => {
    insertUser('owner-hash', 'Owner');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'owner-hash',
      body: { sharedWithUserShareCode: getUserShareCode('owner-hash') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./save-user-share-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(404);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 0 });
  });
});
