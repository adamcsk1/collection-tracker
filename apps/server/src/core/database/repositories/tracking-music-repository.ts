import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import Database from 'better-sqlite3';
import { debugLog } from '../../logger';
import { getItemHash } from '../../utils/collection-item-util';
import { toApiItem } from './collection/collection-mapper';
import { collectionItemProjection, CollectionItemRow } from './collection/collection-model';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from './collection/collection-read-repository';
import { deleteCollectionItemByExternalId, insertCollectionItem } from './collection/collection-write-repository';
import { resolveCanonicalItemId } from './external-item-identity-repository';

const toCompletedAlbumChange = (db: Database.Database, row: CollectionItemRow): CollectionItemChangeApiModel | null => {
  const sourceItem = toApiItem(db, row, row.username_hash);
  if (sourceItem.contentType !== 'album') return null;
  const item = toCollectionItemChange(sourceItem);
  item.favorite = false;
  return item;
};

const copyAlbumRowToTracking = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  sourceRow: CollectionItemRow,
  sourceListType: CollectionListTypeModel,
  deleteSource: boolean,
  markCompleted: boolean
): CollectionItemApiModel | null => {
  if (sourceRow.content_type !== 'album') return null;

  const trackerItem =
    (sourceRow.canonical_item_id
      ? findCollectionItemByCanonicalItemId(db, usernameHash, sourceRow.canonical_item_id, 'tracking')
      : undefined) ??
    findCollectionItemByExternalId(
      db,
      usernameHash,
      sourceRow.external_provider,
      sourceRow.external_item_id ?? '',
      'tracking'
    );
  if (trackerItem) {
    if (markCompleted) {
      db.prepare(
        `INSERT INTO collection_item_tracker_state (item_id, completed_at)
         VALUES (?, CURRENT_TIMESTAMP)
         ON CONFLICT(item_id) DO UPDATE SET completed_at = COALESCE(collection_item_tracker_state.completed_at, excluded.completed_at)`
      ).run(trackerItem.id);
    }
    if (deleteSource) {
      deleteCollectionItemByExternalId(
        db,
        sourceOwnerHash,
        sourceRow.external_provider,
        sourceRow.external_item_id ?? '',
        sourceListType
      );
    }
    return toApiItem(
      db,
      findCollectionItemByExternalId(
        db,
        usernameHash,
        trackerItem.external_provider,
        trackerItem.external_item_id ?? '',
        'tracking'
      ) ?? trackerItem,
      usernameHash
    );
  }

  const item = toCompletedAlbumChange(db, sourceRow);
  if (!item) return null;
  const transaction = db.transaction(() => {
    const insertedItem = insertCollectionItem(
      db,
      usernameHash,
      getItemHash(item),
      item,
      'tracking',
      undefined,
      undefined,
      undefined,
      undefined,
      markCompleted
    );
    if (deleteSource) {
      deleteCollectionItemByExternalId(
        db,
        sourceOwnerHash,
        sourceRow.external_provider,
        sourceRow.external_item_id ?? '',
        sourceListType
      );
    }
    return insertedItem;
  });
  return transaction();
};

export const copyAlbumRowToCompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  sourceRow: CollectionItemRow,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null =>
  copyAlbumRowToTracking(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource, true);

export const copyAlbumToCompletedByExternalId = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  externalProvider: string,
  externalItemId: string,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const canonicalItemId = resolveCanonicalItemId(db, sourceOwnerHash, externalProvider, externalItemId);
  const sourceRow =
    findCollectionItemByCanonicalItemId(db, sourceOwnerHash, canonicalItemId, sourceListType) ??
    findCollectionItemByExternalId(db, sourceOwnerHash, externalProvider, externalItemId, sourceListType);
  if (!sourceRow) return null;
  return copyAlbumRowToCompleted(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const copyAlbumToTrackingByExternalId = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  externalProvider: string,
  externalItemId: string,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const canonicalItemId = resolveCanonicalItemId(db, sourceOwnerHash, externalProvider, externalItemId);
  const sourceRow =
    findCollectionItemByCanonicalItemId(db, sourceOwnerHash, canonicalItemId, sourceListType) ??
    findCollectionItemByExternalId(db, sourceOwnerHash, externalProvider, externalItemId, sourceListType);
  if (!sourceRow) return null;
  return copyAlbumRowToTracking(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource, false);
};

export const clearCompletedAlbumTrackingItem = (db: Database.Database, row: CollectionItemRow): boolean => {
  if (row.content_type !== 'album') return false;
  db.prepare('UPDATE collection_item_tracker_state SET completed_at = NULL WHERE item_id = ?').run(row.id);
  return true;
};

export const deleteCompletedAlbumByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): boolean => {
  const existingItem = findCollectionItemByExternalId(db, usernameHash, externalProvider, externalItemId, 'tracking');
  if (!existingItem) return false;
  return clearCompletedAlbumTrackingItem(db, existingItem);
};

export const markAllMusicAsCompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash,
  sourceItemIds?: readonly number[]
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
          AND list_type = ?
            ${sourceItemIds ? 'AND id IN (SELECT value FROM json_each(?))' : ''}
           AND content_type = 'album'
           AND NOT EXISTS (
             SELECT 1 FROM collection_items album_tracker
             INNER JOIN collection_item_tracker_state album_tracker_state
               ON album_tracker_state.item_id = album_tracker.id
              AND album_tracker_state.completed_at IS NOT NULL
             WHERE album_tracker.username_hash = ?
              AND (
                (album_tracker.canonical_item_id IS NOT NULL AND album_tracker.canonical_item_id = collection_items.canonical_item_id)
                OR (album_tracker.external_provider = collection_items.external_provider AND album_tracker.external_item_id = collection_items.external_item_id)
              )
              AND album_tracker.list_type = ?
           )`
    )
    .all(
      sourceOwnerHash,
      'music',
      ...(sourceItemIds ? [JSON.stringify(sourceItemIds)] : []),
      usernameHash,
      'tracking'
    ) as CollectionItemRow[];

  void debugLog(
    `markAllMusicAsCompleted candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      copyAlbumRowToCompleted(db, usernameHash, sourceOwnerHash, row, 'music', false);
    }
  });
  transaction();
  return rows.length;
};

export const markAllMusicAsUncompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash,
  sourceItemIds?: readonly number[]
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection('album_tracker')} FROM collection_items album_tracker
       INNER JOIN collection_item_tracker_state album_tracker_state
         ON album_tracker_state.item_id = album_tracker.id
        AND album_tracker_state.completed_at IS NOT NULL
       WHERE album_tracker.username_hash = ?
         AND album_tracker.list_type = ?
         AND album_tracker.content_type = 'album'
           AND EXISTS (
             SELECT 1 FROM collection_items library_item
             WHERE library_item.username_hash = ?
              AND (
                (library_item.canonical_item_id IS NOT NULL AND library_item.canonical_item_id = album_tracker.canonical_item_id)
                OR (library_item.external_provider = album_tracker.external_provider AND library_item.external_item_id = album_tracker.external_item_id)
              )
              AND library_item.list_type = ?
              ${sourceItemIds ? 'AND library_item.id IN (SELECT value FROM json_each(?))' : ''}
            )`
    )
    .all(
      usernameHash,
      'tracking',
      sourceOwnerHash,
      'music',
      ...(sourceItemIds ? [JSON.stringify(sourceItemIds)] : [])
    ) as CollectionItemRow[];

  void debugLog(
    `markAllMusicAsUncompleted candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      clearCompletedAlbumTrackingItem(db, row);
    }
  });
  transaction();
  return rows.length;
};
