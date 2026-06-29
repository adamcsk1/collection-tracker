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

describe('delete-incoming-user-share-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

    const response = mockResponse();
    const request: any = {
      usernameHash: 'friend-hash',
      params: { ownerUserShareCode: getUserShareCode('owner-hash') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-incoming-user-share-api');
    register(app);

    expect(app.delete).toHaveBeenCalledWith(
      `${API_PREFIX}/user/shares/incoming/:ownerUserShareCode`,
      expect.anything(),
      expect.anything()
    );

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM user_shares').get()).toEqual({ count: 0 });
  });
});
