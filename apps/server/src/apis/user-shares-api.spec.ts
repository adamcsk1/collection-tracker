import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_PREFIX } from '@shared/constants/api-const';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const buildRegisteredApp = async () => {
  const handlers = new Map<string, (request: any, response: any) => Promise<void>>();
  const registerRoute = (method: string) => (path: string, _options: unknown, handler: any) => {
    handlers.set(`${method} ${path}`, handler);
  };
  const app = {
    get: vi.fn(registerRoute('GET')),
    post: vi.fn(registerRoute('POST')),
    delete: vi.fn(registerRoute('DELETE')),
  } as unknown as FastifyInstance;

  const { register } = await import('./user-shares-api');
  register(app);

  return handlers;
};

const insertUser = (usernameHash: string, username: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, username);
};

describe('user-shares-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns short share codes and display usernames for shares', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    insertUser('current-hash', 'Current');
    getDatabase()
      .prepare(
        `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('current-hash', 'friend-hash', 1, 0, 1, 0);
    getDatabase()
      .prepare(
        `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('owner-hash', 'current-hash', 1, 1, 0, 0);

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`GET ${API_PREFIX}/user/shares`)!({ usernameHash: 'current-hash' }, response);

    expect(response.send).toHaveBeenCalledWith({
      userShareCode: getUserShareCode('current-hash'),
      outgoing: [
        {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          canRead: true,
          canCreate: false,
          canUpdate: true,
          canDelete: false,
        },
      ],
      incoming: [
        {
          ownerUserShareCode: getUserShareCode('owner-hash'),
          ownerUsername: 'Owner',
          canRead: true,
          canCreate: true,
          canUpdate: false,
          canDelete: false,
        },
      ],
    });
  });

  it('creates a share from a short share code and implies read permission', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`POST ${API_PREFIX}/user/shares`)!(
      {
        usernameHash: 'owner-hash',
        body: {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          canRead: false,
          canCreate: true,
          canUpdate: false,
          canDelete: false,
        },
      },
      response
    );

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

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`POST ${API_PREFIX}/user/shares`)!(
      {
        usernameHash: 'owner-hash',
        body: {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          canRead: true,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
        },
      },
      response
    );

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
    const handlers = await buildRegisteredApp();
    const missingResponse = mockResponse();
    await handlers.get(`POST ${API_PREFIX}/user/shares`)!(
      { usernameHash: 'owner-hash', body: { sharedWithUserShareCode: ' ' } },
      missingResponse
    );
    expect(missingResponse.code).toHaveBeenCalledWith(400);

    const unknownResponse = mockResponse();
    await handlers.get(`POST ${API_PREFIX}/user/shares`)!(
      { usernameHash: 'owner-hash', body: { sharedWithUserShareCode: 'unknown-share-code' } },
      unknownResponse
    );
    expect(unknownResponse.code).toHaveBeenCalledWith(404);
  });

  it('does not allow sharing with the current user', async () => {
    insertUser('owner-hash', 'Owner');

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`POST ${API_PREFIX}/user/shares`)!(
      { usernameHash: 'owner-hash', body: { sharedWithUserShareCode: getUserShareCode('owner-hash') } },
      response
    );

    expect(response.code).toHaveBeenCalledWith(404);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 0 });
  });

  it('allows invited users to revoke incoming shares', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    getDatabase()
      .prepare(
        `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('owner-hash', 'friend-hash', 1, 1, 0, 0);

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`DELETE ${API_PREFIX}/user/shares/incoming/:ownerUserShareCode`)!(
      { usernameHash: 'friend-hash', params: { ownerUserShareCode: getUserShareCode('owner-hash') } },
      response
    );

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 0 });
  });

  it('allows owners to remove outgoing shares', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    getDatabase()
      .prepare(
        `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('owner-hash', 'friend-hash', 1, 1, 1, 1);

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`DELETE ${API_PREFIX}/user/shares/:sharedWithUserShareCode`)!(
      { usernameHash: 'owner-hash', params: { sharedWithUserShareCode: getUserShareCode('friend-hash') } },
      response
    );

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 0 });
  });
});
