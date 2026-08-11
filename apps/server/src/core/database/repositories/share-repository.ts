import type {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  UserShareGrantApiModel,
} from '@shared/models/api-model';
import type { SharePermission } from '@shared/models/share-grant-model';
import { normalizeShareGrants } from '@shared/utils/share-grant-util';
import Database from 'better-sqlite3';
import {
  CollectionItemShareDetails,
  CollectionItemShareSelection,
  ShareScopeItemAccess,
  UserShareDetailsModel,
  UserShareDetailsRow,
  UserShareGrantRow,
} from './share-model';
import type { CollectionItemRow } from './collection/collection-model';

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
          grants.can_delete,
          grants.scope_mode
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
        readMode: row.scope_mode!,
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
  const desiredGrants = new Map<string, UserShareGrantApiModel>(
    normalizedGrants.map((grant) => [`${grant.listType}:${grant.contentType}`, grant] as const)
  );

  const upsertRelationship = db.prepare(
    `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash)
     VALUES (?, ?)
     ON CONFLICT(owner_username_hash, shared_with_username_hash) DO NOTHING`
  );

  const upsertGrant = db.prepare(
    `INSERT INTO user_share_grants (
       owner_username_hash, shared_with_username_hash, list_type, content_type,
       can_read, can_create, can_update, can_delete, scope_mode
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_username_hash, shared_with_username_hash, list_type, content_type)
     DO UPDATE SET
       can_read = excluded.can_read,
       can_create = excluded.can_create,
       can_update = excluded.can_update,
       can_delete = excluded.can_delete,
       scope_mode = excluded.scope_mode`
  );

  const deleteScopeSelections = db.prepare(
    `DELETE FROM user_share_item_selections
     WHERE owner_username_hash = ? AND shared_with_username_hash = ?
       AND collection_item_id IN (
         SELECT id FROM collection_items WHERE username_hash = ? AND list_type = ? AND content_type = ?
       )`
  );
  const hasScopeSelections = db.prepare(
    `SELECT 1 FROM user_share_item_selections selected
     INNER JOIN collection_items selected_item ON selected_item.id = selected.collection_item_id
     WHERE selected.owner_username_hash = ? AND selected.shared_with_username_hash = ?
       AND selected_item.list_type = ? AND selected_item.content_type = ?
     LIMIT 1`
  );
  const deleteGrant = db.prepare(
    `DELETE FROM user_share_grants
     WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND list_type = ? AND content_type = ?`
  );

  const run = db.transaction(() => {
    upsertRelationship.run(ownerHash, sharedWithHash);
    const existingGrants = db
      .prepare(
        `SELECT list_type, content_type, scope_mode FROM user_share_grants
         WHERE owner_username_hash = ? AND shared_with_username_hash = ?`
      )
      .all(ownerHash, sharedWithHash) as Array<Pick<UserShareGrantRow, 'list_type' | 'content_type' | 'scope_mode'>>;

    for (const existingGrant of existingGrants) {
      const scopeKey = `${existingGrant.list_type}:${existingGrant.content_type}`;
      const desiredGrant = desiredGrants.get(scopeKey);
      if (!desiredGrant) {
        deleteScopeSelections.run(
          ownerHash,
          sharedWithHash,
          ownerHash,
          existingGrant.list_type,
          existingGrant.content_type
        );
        deleteGrant.run(ownerHash, sharedWithHash, existingGrant.list_type, existingGrant.content_type);
        continue;
      }

      const desiredMode = desiredGrant.readMode;
      if (desiredMode === 'all' && existingGrant.scope_mode === 'selected') {
        deleteScopeSelections.run(
          ownerHash,
          sharedWithHash,
          ownerHash,
          existingGrant.list_type,
          existingGrant.content_type
        );
      }
    }

    for (const grant of normalizedGrants) {
      const scopeMode = grant.readMode;
      if (
        scopeMode === 'selected' &&
        !hasScopeSelections.get(ownerHash, sharedWithHash, grant.listType, grant.contentType)
      ) {
        deleteGrant.run(ownerHash, sharedWithHash, grant.listType, grant.contentType);
        continue;
      }

      upsertGrant.run(
        ownerHash,
        sharedWithHash,
        grant.listType,
        grant.contentType,
        grant.canRead ? 1 : 0,
        grant.canCreate ? 1 : 0,
        grant.canUpdate ? 1 : 0,
        grant.canDelete ? 1 : 0,
        scopeMode
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

export const hasUserShareRelationship = (db: Database.Database, ownerHash: string, sharedWithHash: string): boolean =>
  !!db
    .prepare('SELECT 1 FROM user_shares WHERE owner_username_hash = ? AND shared_with_username_hash = ?')
    .get(ownerHash, sharedWithHash);

export const canAccessShare = (
  db: Database.Database,
  accessorHash: string,
  targetOwnerHash: string,
  listType: CollectionListTypeModel,
  contentType: CollectionItemContentTypeModel,
  permission: SharePermission,
  collectionItemId?: number
): boolean => {
  if (accessorHash === targetOwnerHash) return true;

  const row = db
    .prepare(
      `SELECT can_read, can_create, can_update, can_delete, scope_mode
       FROM user_share_grants
       WHERE owner_username_hash = ?
         AND shared_with_username_hash = ?
         AND list_type = ?
         AND content_type = ?`
    )
    .get(targetOwnerHash, accessorHash, listType, contentType) as UserShareGrantRow | undefined;

  if (!row) return false;

  const selectedItemAllowed =
    row.scope_mode === 'all' ||
    permission === 'create' ||
    (collectionItemId !== undefined &&
      !!db
        .prepare(
          `SELECT 1 FROM user_share_item_selections
           WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND collection_item_id = ?`
        )
        .get(targetOwnerHash, accessorHash, collectionItemId));
  if (!selectedItemAllowed) return false;

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

export const findAccessibleShareItemIds = (
  db: Database.Database,
  accessorHash: string,
  ownerHash: string,
  listType: CollectionListTypeModel,
  contentTypes: readonly CollectionItemContentTypeModel[],
  permission: SharePermission
): ShareScopeItemAccess => {
  if (!contentTypes.length) return { authorized: false, itemIds: [] };
  if (accessorHash === ownerHash) {
    const rows = db
      .prepare(
        `SELECT id FROM collection_items
         WHERE username_hash = ? AND list_type = ?
           AND content_type IN (SELECT value FROM json_each(?))`
      )
      .all(ownerHash, listType, JSON.stringify(contentTypes)) as Array<{ id: number }>;
    return { authorized: true, itemIds: rows.map((row) => row.id) };
  }

  const permissionColumn = {
    read: 'can_read',
    create: 'can_create',
    update: 'can_update',
    delete: 'can_delete',
  }[permission];
  const grants = db
    .prepare(
      `SELECT content_type, scope_mode FROM user_share_grants
       WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND list_type = ?
         AND content_type IN (SELECT value FROM json_each(?)) AND ${permissionColumn} = 1`
    )
    .all(ownerHash, accessorHash, listType, JSON.stringify(contentTypes)) as Array<{
    content_type: CollectionItemContentTypeModel;
    scope_mode: 'selected' | 'all';
  }>;
  if (!grants.length) return { authorized: false, itemIds: [] };

  const broadContentTypes = grants.filter((grant) => grant.scope_mode === 'all').map((grant) => grant.content_type);
  const rows = db
    .prepare(
      `SELECT id FROM collection_items
       WHERE username_hash = ? AND list_type = ?
         AND (
           content_type IN (SELECT value FROM json_each(?))
           OR id IN (
             SELECT collection_item_id FROM user_share_item_selections
             WHERE owner_username_hash = ? AND shared_with_username_hash = ?
           )
         )
         AND content_type IN (SELECT value FROM json_each(?))`
    )
    .all(
      ownerHash,
      listType,
      JSON.stringify(broadContentTypes),
      ownerHash,
      accessorHash,
      JSON.stringify(grants.map((grant) => grant.content_type))
    ) as Array<{ id: number }>;
  return { authorized: true, itemIds: rows.map((row) => row.id) };
};

export const findIncomingGrantsForViewer = (
  db: Database.Database,
  usernameHash: string
): Array<UserShareGrantApiModel & { ownerHash: string }> => {
  const rows = db
    .prepare(
      `SELECT owner_username_hash, list_type, content_type, can_read, can_create, can_update, can_delete, scope_mode
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
    readMode: row.scope_mode,
  }));
};

export const findCollectionItemShares = (
  db: Database.Database,
  ownerHash: string,
  item: CollectionItemRow
): CollectionItemShareDetails[] =>
  (
    db
      .prepare(
        `SELECT shares.shared_with_username_hash, recipient.username,
                grants.can_read, grants.can_create, grants.can_update, grants.can_delete, grants.scope_mode,
                selections.collection_item_id AS selected_item_id
         FROM user_shares shares
         LEFT JOIN users recipient ON recipient.username_hash = shares.shared_with_username_hash
         LEFT JOIN user_share_grants grants
           ON grants.owner_username_hash = shares.owner_username_hash
          AND grants.shared_with_username_hash = shares.shared_with_username_hash
          AND grants.list_type = ? AND grants.content_type = ?
         LEFT JOIN user_share_item_selections selections
           ON selections.owner_username_hash = shares.owner_username_hash
          AND selections.shared_with_username_hash = shares.shared_with_username_hash
          AND selections.collection_item_id = ?
         WHERE shares.owner_username_hash = ?
         ORDER BY recipient.username, shares.shared_with_username_hash`
      )
      .all(item.list_type, item.content_type, item.id, ownerHash) as Array<{
      shared_with_username_hash: string;
      username: string | null;
      can_read: number | null;
      can_create: number | null;
      can_update: number | null;
      can_delete: number | null;
      scope_mode: 'selected' | 'all' | null;
      selected_item_id: number | null;
    }>
  ).map((row) => ({
    sharedWithUsernameHash: row.shared_with_username_hash,
    sharedWithUsername: row.username,
    readMode: row.scope_mode === 'all' ? 'all' : row.selected_item_id === item.id ? 'selected' : 'none',
    permissions:
      row.scope_mode === null
        ? null
        : {
            canRead: row.can_read === 1,
            canCreate: row.can_create === 1,
            canUpdate: row.can_update === 1,
            canDelete: row.can_delete === 1,
          },
  }));

export const replaceCollectionItemSelections = (
  db: Database.Database,
  ownerHash: string,
  item: CollectionItemRow,
  selections: CollectionItemShareSelection[]
): void => {
  db.transaction(() => {
    const desiredRecipients = new Set(selections.map((selection) => selection.sharedWithUsernameHash));
    const existingRows = db
      .prepare(
        `SELECT shared_with_username_hash FROM user_share_item_selections
         WHERE owner_username_hash = ? AND collection_item_id = ?`
      )
      .all(ownerHash, item.id) as Array<{ shared_with_username_hash: string }>;

    for (const row of existingRows) {
      if (desiredRecipients.has(row.shared_with_username_hash)) continue;
      db.prepare(
        `DELETE FROM user_share_item_selections
         WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND collection_item_id = ?`
      ).run(ownerHash, row.shared_with_username_hash, item.id);
      db.prepare(
        `DELETE FROM user_share_grants
         WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND list_type = ? AND content_type = ?
           AND scope_mode = 'selected'
           AND NOT EXISTS (
             SELECT 1 FROM user_share_item_selections remaining
             INNER JOIN collection_items remaining_item ON remaining_item.id = remaining.collection_item_id
             WHERE remaining.owner_username_hash = ? AND remaining.shared_with_username_hash = ?
               AND remaining_item.list_type = ? AND remaining_item.content_type = ?
           )`
      ).run(
        ownerHash,
        row.shared_with_username_hash,
        item.list_type,
        item.content_type,
        ownerHash,
        row.shared_with_username_hash,
        item.list_type,
        item.content_type
      );
    }

    for (const selection of selections) {
      const grant = db
        .prepare(
          `SELECT scope_mode FROM user_share_grants
           WHERE owner_username_hash = ? AND shared_with_username_hash = ? AND list_type = ? AND content_type = ?`
        )
        .get(ownerHash, selection.sharedWithUsernameHash, item.list_type, item.content_type) as
        { scope_mode: 'selected' | 'all' } | undefined;
      if (grant?.scope_mode === 'all') throw new Error('BROAD_SHARE_SELECTION');
      if (!grant) {
        if (!selection.permissions?.canRead) throw new Error('MISSING_SHARE_PERMISSIONS');
        db.prepare(
          `INSERT INTO user_share_grants
           (owner_username_hash, shared_with_username_hash, list_type, content_type,
            can_read, can_create, can_update, can_delete, scope_mode)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'selected')`
        ).run(
          ownerHash,
          selection.sharedWithUsernameHash,
          item.list_type,
          item.content_type,
          selection.permissions.canCreate ? 1 : 0,
          selection.permissions.canUpdate ? 1 : 0,
          selection.permissions.canDelete ? 1 : 0
        );
      }
      db.prepare(
        `INSERT OR IGNORE INTO user_share_item_selections
         (owner_username_hash, shared_with_username_hash, collection_item_id) VALUES (?, ?, ?)`
      ).run(ownerHash, selection.sharedWithUsernameHash, item.id);
    }
  })();
};

export const selectCreatedCollectionItem = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string,
  collectionItemId: number
): void => {
  db.prepare(
    `INSERT INTO user_share_item_selections (owner_username_hash, shared_with_username_hash, collection_item_id)
     SELECT ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM user_share_grants grant_scope
       INNER JOIN collection_items created_item ON created_item.id = ?
       WHERE grant_scope.owner_username_hash = ? AND grant_scope.shared_with_username_hash = ?
         AND grant_scope.list_type = created_item.list_type AND grant_scope.content_type = created_item.content_type
         AND grant_scope.scope_mode = 'selected'
     )`
  ).run(ownerHash, sharedWithHash, collectionItemId, collectionItemId, ownerHash, sharedWithHash);
};
