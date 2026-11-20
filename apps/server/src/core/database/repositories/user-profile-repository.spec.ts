import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import { deleteUser, getUserShareCode, insertUser } from './user-repository';
import { findUserAvatar, findUserProfile, updateUserAvatar, updateUserDisplayName } from './user-profile-repository';

describe('user-profile-repository', () => {
  it('keeps display name and avatar independent, with metadata-only profile reads', () => {
    const db = getDatabase();
    insertUser(db, 'user', 'token', 'Username');
    expect(findUserProfile(db, 'user')).toEqual({
      userShareCode: getUserShareCode('user'),
      username: 'Username',
      displayName: null,
      avatarRevision: null,
    });
    expect(findUserProfile(db, 'missing')).toBeUndefined();
    expect(findUserAvatar(db, 'user')).toBeNull();
    updateUserDisplayName(db, 'user', 'Name');
    updateUserAvatar(db, 'user', Buffer.from('first'));
    const firstRevision = findUserProfile(db, 'user')!.avatarRevision;
    updateUserDisplayName(db, 'user', null);
    expect(findUserAvatar(db, 'user')).toEqual(Buffer.from('first'));
    expect(findUserProfile(db, 'user')!.avatarRevision).toBe(firstRevision);
    updateUserAvatar(db, 'user', Buffer.from('second'));
    expect(findUserProfile(db, 'user')!.avatarRevision).not.toBe(firstRevision);
    updateUserAvatar(db, 'user', null);
    expect(findUserProfile(db, 'user')).toEqual({
      userShareCode: getUserShareCode('user'),
      username: 'Username',
      displayName: null,
      avatarRevision: null,
    });
    expect(findUserAvatar(db, 'user')).toBeNull();
  });

  it('cascades profile metadata and bytes when the user is deleted', () => {
    const db = getDatabase();
    insertUser(db, 'user', 'token', 'Username');
    updateUserDisplayName(db, 'user', 'Name');
    updateUserAvatar(db, 'user', Buffer.from('avatar'));
    deleteUser(db, 'user');
    expect(db.prepare('SELECT * FROM user_profiles').all()).toEqual([]);
    expect(findUserAvatar(db, 'user')).toBeNull();
  });

  it('rejects orphan profiles and inconsistent avatar/revision writes', () => {
    const db = getDatabase();
    expect(() => updateUserDisplayName(db, 'missing', 'Name')).toThrow();
    insertUser(db, 'user', 'token', 'Username');
    updateUserAvatar(db, 'user', Buffer.from('avatar'));
    const before = findUserProfile(db, 'user');
    expect(() =>
      db.prepare('UPDATE user_profiles SET avatar_revision = NULL WHERE username_hash = ?').run('user')
    ).toThrow();
    expect(findUserProfile(db, 'user')).toEqual(before);
    expect(findUserAvatar(db, 'user')).toEqual(Buffer.from('avatar'));
  });
});
