import { USER_AVATAR_MAX_BASE64_LENGTH } from '@shared/constants/user-profile-const';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserProfileTestApp, insertUserProfileTestUser } from '../../test/mocks/user-profile-app-mock';
import { getDatabase } from '../core/database/database';
import {
  findUserAvatar,
  findUserProfile,
  updateUserDisplayName,
} from '../core/database/repositories/user-profile-repository';
import { register } from './put-user-avatar-api';

describe('put-user-avatar-api', () => {
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
      (await app.inject({ method: 'PUT', url: '/api/v1/users/me/avatar', payload: { imageBase64: 'invalid' } }))
        .statusCode
    ).toBe(401);
  });

  it('sanitizes uploads, preserves display name, rotates revisions, and keeps previous avatar after invalid replacement', async () => {
    const user = await insertUserProfileTestUser('current');
    updateUserDisplayName(getDatabase(), user.usernameHash, 'Name');
    const image = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#ff0000' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const upload = () =>
      app.inject({
        method: 'PUT',
        url: '/api/v1/users/me/avatar',
        headers: user.headers,
        payload: { imageBase64: image.toString('base64') },
      });
    const first = await upload();
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({
      data: {
        userShareCode: user.shareCode,
        username: 'current',
        displayName: 'Name',
        avatarRevision: expect.stringMatching(/^[\da-f-]{36}$/),
      },
    });
    const stored = findUserAvatar(getDatabase(), user.usernameHash)!;
    expect(await sharp(stored).metadata()).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect((await sharp(stored).metadata()).orientation).toBeUndefined();
    const second = await upload();
    expect(second.json().data.avatarRevision).not.toBe(first.json().data.avatarRevision);
    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me/avatar',
      headers: user.headers,
      payload: { imageBase64: image.subarray(0, 50).toString('base64') },
    });
    expect(invalid.statusCode).toBe(400);
    expect(findUserProfile(getDatabase(), user.usernameHash)?.avatarRevision).toBe(second.json().data.avatarRevision);
    expect(findUserAvatar(getDatabase(), user.usernameHash)).toEqual(stored);
  });

  it.each([{}, { imageBase64: 5 }, { imageBase64: 'invalid' }, { imageBase64: 'AA==', displayName: 'Name' }, [[]]])(
    'rejects invalid upload body %j',
    async (payload) => {
      const user = await insertUserProfileTestUser('current');
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me/avatar',
        headers: user.headers,
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(getDatabase().prepare('SELECT * FROM user_profiles').all()).toEqual([]);
    }
  );

  it('limits request body before processing an oversized upload', async () => {
    const user = await insertUserProfileTestUser('current');
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me/avatar',
      headers: user.headers,
      payload: { imageBase64: 'A'.repeat(USER_AVATAR_MAX_BASE64_LENGTH + 1024) },
    });
    expect(response.statusCode).toBe(413);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});
