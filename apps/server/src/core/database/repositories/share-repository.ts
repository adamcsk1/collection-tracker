import Database from 'better-sqlite3';
import { UserShareRow } from './share-model';

export const findOutgoingShares = (db: Database.Database, usernameHash: string): UserShareRow[] => {
  return db.prepare('SELECT * FROM user_shares WHERE owner_username_hash = ?').all(usernameHash) as UserShareRow[];
};

export const findIncomingShares = (db: Database.Database, usernameHash: string): UserShareRow[] => {
  return db
    .prepare('SELECT * FROM user_shares WHERE shared_with_username_hash = ?')
    .all(usernameHash) as UserShareRow[];
};

export const upsertShare = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string,
  permissions: { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }
): void => {
  db.prepare(
    `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_username_hash, shared_with_username_hash) DO UPDATE SET
       can_read = excluded.can_read,
       can_create = excluded.can_create,
       can_update = excluded.can_update,
       can_delete = excluded.can_delete`
  ).run(
    ownerHash,
    sharedWithHash,
    permissions.canRead ? 1 : 0,
    permissions.canCreate ? 1 : 0,
    permissions.canUpdate ? 1 : 0,
    permissions.canDelete ? 1 : 0
  );
};

export const deleteShare = (db: Database.Database, ownerHash: string, sharedWithHash: string): void => {
  db.prepare('DELETE FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?').run(
    ownerHash,
    sharedWithHash
  );
};

export const canAccessLibrary = (
  db: Database.Database,
  accessorHash: string,
  targetOwnerHash: string,
  permission: 'read' | 'create' | 'update' | 'delete'
): boolean => {
  if (accessorHash === targetOwnerHash) return true;
  const row = db
    .prepare(
      'SELECT can_read, can_create, can_update, can_delete FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?'
    )
    .get(targetOwnerHash, accessorHash) as UserShareRow | undefined;
  if (!row) return false;
  switch (permission) {
    case 'read':
      return row.can_read === 1;
    case 'create':
      return row.can_create === 1;
    case 'update':
      return row.can_update === 1;
    case 'delete':
      return row.can_delete === 1;
    default:
      return false;
  }
};

export const findReadableOwnerHashes = (db: Database.Database, usernameHash: string): string[] => {
  const rows = db
    .prepare('SELECT owner_username_hash FROM user_shares WHERE shared_with_username_hash = ? AND can_read = 1')
    .all(usernameHash) as Array<{ owner_username_hash: string }>;
  return rows.map((row) => row.owner_username_hash);
};
