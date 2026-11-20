import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserProfileTestApp, insertUserProfileTestUser } from '../../test/mocks/user-profile-app-mock';
import { getDatabase } from '../core/database/database';
import { updateUserAvatar } from '../core/database/repositories/user-profile-repository';
import { deleteShare, upsertShare } from '../core/database/repositories/share-repository';
import { register } from './get-user-avatar-api';

describe('get-user-avatar-api', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await buildUserProfileTestApp(register);
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/users/unknown/avatar' })).statusCode).toBe(401);
  });

  it('serves own binary WebP privately and never envelopes bytes', async () => {
    const user = await insertUserProfileTestUser('current');
    const avatar = Buffer.from('stored-webp');
    updateUserAvatar(getDatabase(), user.usernameHash, avatar);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${user.shareCode}/avatar`,
      headers: user.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.rawPayload).toEqual(avatar);
  });

  it.each(['incoming', 'outgoing'])(
    'authorizes %s relationships without grants and revokes immediately',
    async (direction) => {
      const user = await insertUserProfileTestUser('current');
      const target = await insertUserProfileTestUser('target');
      updateUserAvatar(getDatabase(), target.usernameHash, Buffer.from('stored-webp'));
      const ownerHash = direction === 'incoming' ? target.usernameHash : user.usernameHash;
      const recipientHash = direction === 'incoming' ? user.usernameHash : target.usernameHash;
      upsertShare(getDatabase(), ownerHash, recipientHash, []);
      const getAvatar = () =>
        app.inject({
          method: 'GET',
          url: `/api/v1/users/${target.shareCode}/avatar?revision=old`,
          headers: { ...user.headers, 'if-none-match': 'anything' },
        });
      expect((await getAvatar()).statusCode).toBe(200);
      deleteShare(getDatabase(), ownerHash, recipientHash);
      const revoked = await getAvatar();
      expect(revoked.statusCode).toBe(404);
      expect(revoked.headers['cache-control']).toBe('private, no-store');
    }
  );

  it('returns indistinguishable 404 for unknown, missing, and denied avatars', async () => {
    const user = await insertUserProfileTestUser('current');
    const target = await insertUserProfileTestUser('target');
    updateUserAvatar(getDatabase(), target.usernameHash, Buffer.from('stored-webp'));
    for (const shareCode of ['unknown', user.shareCode, target.shareCode]) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${shareCode}/avatar`,
        headers: user.headers,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ status: 404, code: 'HTTP_404' });
      expect(response.json()).not.toHaveProperty('detail');
    }
  });
});
