import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserProfileTestApp, insertUserProfileTestUser } from '../../test/mocks/user-profile-app-mock';
import { getDatabase } from '../core/database/database';
import { findUserProfile, updateUserDisplayName } from '../core/database/repositories/user-profile-repository';
import { register } from './change-user-profile-api';

describe('change-user-profile-api', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await buildUserProfileTestApp(register);
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('requires authentication', async () => {
    expect(
      (await app.inject({ method: 'PATCH', url: '/api/v1/users/me/profile', payload: { displayName: 'Name' } }))
        .statusCode
    ).toBe(401);
  });

  it.each(['   Name 🐈   ', '🐈'.repeat(80), '', '   ', null])('normalizes display name %s', async (displayName) => {
    const user = await insertUserProfileTestUser('current');
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/profile',
      headers: user.headers,
      payload: { displayName },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        userShareCode: user.shareCode,
        username: 'current',
        displayName: displayName?.trim() || null,
        avatarRevision: null,
      },
    });
  });

  it.each([
    {},
    { displayName: 1 },
    { displayName: 'x', username: 'renamed' },
    { displayName: '🐈'.repeat(81) },
    { displayName: 'a\nb' },
    { displayName: '\u0000' },
    { displayName: '\u0085' },
    [[]],
    null,
  ])('rejects invalid bodies without changing existing name: %j', async (payload) => {
    const user = await insertUserProfileTestUser('current');
    updateUserDisplayName(getDatabase(), user.usernameHash, 'Previous');
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/profile',
      headers: { ...user.headers, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
    expect(response.statusCode).toBe(400);
    expect(findUserProfile(getDatabase(), user.usernameHash)?.displayName).toBe('Previous');
  });
});
