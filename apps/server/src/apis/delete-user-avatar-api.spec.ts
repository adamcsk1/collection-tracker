import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserProfileTestApp, insertUserProfileTestUser } from '../../test/mocks/user-profile-app-mock';
import { getDatabase } from '../core/database/database';
import {
  findUserAvatar,
  updateUserAvatar,
  updateUserDisplayName,
} from '../core/database/repositories/user-profile-repository';
import { register } from './delete-user-avatar-api';

describe('delete-user-avatar-api', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await buildUserProfileTestApp(register);
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/users/me/avatar' })).statusCode).toBe(401);
  });

  it('clears bytes and revision idempotently with 200 and preserves display name', async () => {
    const user = await insertUserProfileTestUser('current');
    updateUserAvatar(getDatabase(), user.usernameHash, Buffer.from('stored'));
    updateUserDisplayName(getDatabase(), user.usernameHash, 'Name');
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({ method: 'DELETE', url: '/api/v1/users/me/avatar', headers: user.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: { userShareCode: user.shareCode, username: 'current', displayName: 'Name', avatarRevision: null },
      });
      expect(findUserAvatar(getDatabase(), user.usernameHash)).toBeNull();
    }
  });

  it('succeeds before any profile or avatar exists', async () => {
    const user = await insertUserProfileTestUser('current');
    const response = await app.inject({ method: 'DELETE', url: '/api/v1/users/me/avatar', headers: user.headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.avatarRevision).toBeNull();
  });
});
