import type {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  UserShareGrantApiModel,
} from '@shared/models/api-model';
import type { SharePermission } from '@shared/models/share-grant-model';
import { normalizeShareGrants } from '@shared/utils/share-grant-util';
import Database from 'better-sqlite3';
import { UserShareGrantRow, UserShareRow } from './share-model';

export const findOutgoingShares = (db: Database.Database, usernameHash: string): UserShareRow[] => {
  return db.prepare('SELECT * FROM user_shares WHERE owner_username_hash = ?').all(usernameHash) as UserShareRow[];
};

export const findIncomingShares = (db: Database.Database, usernameHash: string): UserShareRow[] => {
  return db
    .prepare('SELECT * FROM user_shares WHERE shared_with_username_hash = ?')
    .all(usernameHash) as UserShareRow[];
};

export const findGrantsForShare = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string
): UserShareGrantRow[] => {
  return db
    .prepare(
      `SELECT * FROM user_share_grants
       WHERE owner_username_hash = ? AND shared_with_username_hash = ?
       ORDER BY list_type, content_type`
    )
    .all(ownerHash, sharedWithHash) as UserShareGrantRow[];
};

export const mapGrantRowsToApi = (rows: UserShareGrantRow[]): UserShareGrantApiModel[] =>
  rows.map((row) => ({
    listType: row.list_type,
    contentType: row.content_type,
    canRead: row.can_read === 1,
    canCreate: row.can_create === 1,
    canUpdate: row.can_update === 1,
    canDelete: row.can_delete === 1,
  }));

export const upsertShare = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string,
  grants: UserShareGrantApiModel[]
): void => {
  const normalizedGrants = normalizeShareGrants(grants);

  const upsertRelationship = db.prepare(
    `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash)
     VALUES (?, ?)
     ON CONFLICT(owner_username_hash, shared_with_username_hash) DO NOTHING`
  );

  const deleteGrants = db.prepare(
    `DELETE FROM user_share_grants
     WHERE owner_username_hash = ? AND shared_with_username_hash = ?`
  );

  const insertGrant = db.prepare(
    `INSERT INTO user_share_grants (
       owner_username_hash, shared_with_username_hash, list_type, content_type,
       can_read, can_create, can_update, can_delete
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const run = db.transaction(() => {
    upsertRelationship.run(ownerHash, sharedWithHash);
    deleteGrants.run(ownerHash, sharedWithHash);

    if (!normalizedGrants.length) {
      db.prepare('DELETE FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?').run(
        ownerHash,
        sharedWithHash
      );
      return;
    }

    for (const grant of normalizedGrants) {
      insertGrant.run(
        ownerHash,
        sharedWithHash,
        grant.listType,
        grant.contentType,
        grant.canRead ? 1 : 0,
        grant.canCreate ? 1 : 0,
        grant.canUpdate ? 1 : 0,
        grant.canDelete ? 1 : 0
      );
    }
  });

  run();
};

export const deleteShare = (db: Database.Database, ownerHash: string, sharedWithHash: string): void => {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM user_share_grants WHERE owner_username_hash = ? AND shared_with_username_hash = ?').run(
      ownerHash,
      sharedWithHash
    );
    db.prepare('DELETE FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?').run(
      ownerHash,
      sharedWithHash
    );
  });
  run();
};

export const canAccessShare = (
  db: Database.Database,
  accessorHash: string,
  targetOwnerHash: string,
  listType: CollectionListTypeModel,
  contentType: CollectionItemContentTypeModel,
  permission: SharePermission
): boolean => {
  if (accessorHash === targetOwnerHash) return true;

  const row = db
    .prepare(
      `SELECT can_read, can_create, can_update, can_delete
       FROM user_share_grants
       WHERE owner_username_hash = ?
         AND shared_with_username_hash = ?
         AND list_type = ?
         AND content_type = ?`
    )
    .get(targetOwnerHash, accessorHash, listType, contentType) as UserShareGrantRow | undefined;

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

export const findIncomingGrantsForViewer = (
  db: Database.Database,
  usernameHash: string
): Array<UserShareGrantApiModel & { ownerHash: string }> => {
  const rows = db
    .prepare(
      `SELECT owner_username_hash, list_type, content_type, can_read, can_create, can_update, can_delete
       FROM user_share_grants
       WHERE shared_with_username_hash = ?`
    )
    .all(usernameHash) as Array<UserShareGrantRow & { owner_username_hash: string }>;

  return rows.map((row) => ({
    ownerHash: row.owner_username_hash,
    listType: row.list_type,
    contentType: row.content_type,
    canRead: row.can_read === 1,
    canCreate: row.can_create === 1,
    canUpdate: row.can_update === 1,
    canDelete: row.can_delete === 1,
  }));
};
