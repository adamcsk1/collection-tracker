import type { UserProfileApiResponseModel } from '@shared/models/api-model';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getUserShareCode } from './user-repository';

export const findUserProfile = (
  db: Database.Database,
  usernameHash: string
): UserProfileApiResponseModel | undefined => {
  const row = db
    .prepare(
      `SELECT users.username, profiles.display_name, profiles.avatar_revision
     FROM users LEFT JOIN user_profiles profiles ON profiles.username_hash = users.username_hash
     WHERE users.username_hash = ?`
    )
    .get(usernameHash) as
    { username: string | null; display_name: string | null; avatar_revision: string | null } | undefined;
  return (
    row && {
      userShareCode: getUserShareCode(usernameHash),
      username: row.username,
      displayName: row.display_name,
      avatarRevision: row.avatar_revision,
    }
  );
};

export const updateUserDisplayName = (
  db: Database.Database,
  usernameHash: string,
  displayName: string | null
): void => {
  db.prepare(
    `INSERT INTO user_profiles (username_hash, display_name) VALUES (?, ?)
     ON CONFLICT(username_hash) DO UPDATE SET display_name = excluded.display_name`
  ).run(usernameHash, displayName);
};

export const updateUserAvatar = (db: Database.Database, usernameHash: string, avatar: Buffer | null): void => {
  db.prepare(
    `INSERT INTO user_profiles (username_hash, avatar, avatar_revision) VALUES (?, ?, ?)
     ON CONFLICT(username_hash) DO UPDATE SET avatar = excluded.avatar, avatar_revision = excluded.avatar_revision`
  ).run(usernameHash, avatar, avatar === null ? null : randomUUID());
};

export const findUserAvatar = (db: Database.Database, usernameHash: string): Buffer | null => {
  const row = db.prepare('SELECT avatar FROM user_profiles WHERE username_hash = ?').get(usernameHash) as
    { avatar: Buffer | null } | undefined;
  return row?.avatar ?? null;
};
