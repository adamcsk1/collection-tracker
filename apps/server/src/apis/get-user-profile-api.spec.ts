import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserProfileTestApp, insertUserProfileTestUser } from '../../test/mocks/user-profile-app-mock';
import { getDatabase } from '../core/database/database';
import { updateUserAvatar, updateUserDisplayName } from '../core/database/repositories/user-profile-repository';
import { register } from './get-user-profile-api';

describe('get-user-profile-api', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await buildUserProfileTestApp(register);
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/users/me/profile' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('returns nullable legacy username and defaults without creating a profile row', async () => {
    const user = await insertUserProfileTestUser('legacy', null);
    const response = await app.inject({ method: 'GET', url: '/api/v1/users/me/profile', headers: user.headers });
    expect(response.json()).toEqual({
      data: { userShareCode: user.shareCode, username: null, displayName: null, avatarRevision: null },
    });
    expect(getDatabase().prepare('SELECT * FROM user_profiles').all()).toEqual([]);
  });

  it('returns only authenticated user metadata, never avatar bytes', async () => {
    const user = await insertUserProfileTestUser('current');
    await insertUserProfileTestUser('other');
    updateUserDisplayName(getDatabase(), user.usernameHash, 'Current Name');
    updateUserAvatar(getDatabase(), user.usernameHash, Buffer.from('avatar'));
    const response = await app.inject({ method: 'GET', url: '/api/v1/users/me/profile', headers: user.headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        userShareCode: user.shareCode,
        username: 'current',
        displayName: 'Current Name',
        avatarRevision: expect.any(String),
      },
    });
    expect(Object.keys(response.json().data)).toHaveLength(4);
  });
});
