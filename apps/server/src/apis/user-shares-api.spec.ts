import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_PREFIX } from '@shared/constants/api-const';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare, insertShare, libraryGrants } from '../../test/mocks/share-mock';
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

  it('returns short share codes, usernames, and grants', async () => {
    insertUser('owner-hash', 'Owner');
    insertUser('friend-hash', 'Friend');
    insertUser('current-hash', 'Current');
    insertShare(getDatabase(), 'current-hash', 'friend-hash', libraryGrants({ canRead: true, canUpdate: true }));
    insertLibraryShare(getDatabase(), 'owner-hash', 'current-hash', { canRead: true, canCreate: true });

    const handlers = await buildRegisteredApp();
    const response = mockResponse();
    await handlers.get(`${API_PREFIX}/user/shares`)!({ usernameHash: 'current-hash' }, response);

    expect(response.send).toHaveBeenCalledWith({
      userShareCode: getUserShareCode('current-hash'),
      outgoing: [
        {
          sharedWithUserShareCode: getUserShareCode('friend-hash'),
          sharedWithUsername: 'Friend',
          grants: libraryGrants({ canRead: true, canUpdate: true }),
        },
      ],
      incoming: [
        {
          ownerUserShareCode: getUserShareCode('owner-hash'),
          ownerUsername: 'Owner',
          grants: libraryGrants({ canRead: true, canCreate: true }),
        },
      ],
    });
  });
});
