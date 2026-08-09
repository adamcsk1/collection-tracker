import type {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  UserShareGrantApiModel,
} from '@shared/models/api-model';
import type { SharePermission } from '@shared/models/share-grant-model';
import { normalizeShareGrants } from '@shared/utils/share-grant-util';
import Database from 'better-sqlite3';
import { UserShareDetailsModel, UserShareDetailsRow, UserShareGrantRow } from './share-model';

export const findSharesForUser = (db: Database.Database, usernameHash: string): UserShareDetailsModel[] => {
  const rows = db
    .prepare(
      `WITH related_shares AS (
         SELECT
           user_shares.id AS share_id,
           'outgoing' AS direction,
           user_shares.owner_username_hash,
           user_shares.shared_with_username_hash,
           counterpart.username AS counterpart_username
         FROM user_shares
         LEFT JOIN users counterpart ON counterpart.username_hash = user_shares.shared_with_username_hash
         WHERE user_shares.owner_username_hash = ?
         UNION ALL
         SELECT
           user_shares.id AS share_id,
           'incoming' AS direction,
           user_shares.owner_username_hash,
           user_shares.shared_with_username_hash,
           counterpart.username AS counterpart_username
         FROM user_shares
         LEFT JOIN users counterpart ON counterpart.username_hash = user_shares.owner_username_hash
         WHERE user_shares.shared_with_username_hash = ?
       )
       SELECT
         related_shares.*,
         grants.id AS grant_id,
         grants.list_type,
         grants.content_type,
         grants.can_read,
         grants.can_create,
         grants.can_update,
         grants.can_delete
       FROM related_shares
       LEFT JOIN user_share_grants grants
         ON grants.owner_username_hash = related_shares.owner_username_hash
        AND grants.shared_with_username_hash = related_shares.shared_with_username_hash
       ORDER BY related_shares.direction, related_shares.share_id, grants.list_type, grants.content_type`
    )
    .all(usernameHash, usernameHash) as UserShareDetailsRow[];

  const shares = new Map<string, UserShareDetailsModel>();
  for (const row of rows) {
    const key = `${row.direction}:${row.share_id}`;
    const share = shares.get(key) ?? {
      direction: row.direction,
      ownerUsernameHash: row.owner_username_hash,
      sharedWithUsernameHash: row.shared_with_username_hash,
      counterpartUsername: row.counterpart_username,
      grants: [],
    };
    if (row.grant_id !== null) {
      share.grants.push({
        listType: row.list_type!,
        contentType: row.content_type!,
        canRead: row.can_read === 1,
        canCreate: row.can_create === 1,
        canUpdate: row.can_update === 1,
        canDelete: row.can_delete === 1,
      });
    }
    shares.set(key, share);
  }

  return [...shares.values()];
};

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
