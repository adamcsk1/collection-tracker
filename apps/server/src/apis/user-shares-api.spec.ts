import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_PREFIX } from '@shared/constants/api-const';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const buildRegisteredApp = async () => {
  const handlers = new Map<string, (request: any, response: any) => Promise<void>>();
  const app = {
    get: vi.fn((path: string, _options: unknown, handler: any) => handlers.set(path, handler)),
  } as unknown as FastifyInstance;

  const { register: registerGetUserShares } = await import('./user-shares-api');
  registerGetUserShares(app);

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
    await handlers.get(`${API_PREFIX}/user/shares`)!({ usernameHash: 'current-hash' }, response);

    expect(response.send).toHaveBeenCalledWith({
      userShareCode: getUserShareCode('current-hash'),
      outgoing: [
        {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          sharedWithUsername: 'Friend',
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
});
