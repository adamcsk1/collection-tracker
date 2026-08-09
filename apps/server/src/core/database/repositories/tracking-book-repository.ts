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

const toCompletedBookChange = (db: Database.Database, row: CollectionItemRow): CollectionItemChangeApiModel | null => {
  const sourceItem = toApiItem(db, row, row.username_hash);
  if (sourceItem.contentType !== 'book') return null;
  const item = toCollectionItemChange(sourceItem);
  item.favorite = false;
  return item;
};

export const copyBookRowToCompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  sourceRow: CollectionItemRow,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  if (sourceRow.content_type !== 'book') return null;

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
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at)
       VALUES (?, CURRENT_TIMESTAMP)
       ON CONFLICT(item_id) DO UPDATE SET completed_at = COALESCE(collection_item_tracker_state.completed_at, excluded.completed_at)`
    ).run(trackerItem.id);
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

  const item = toCompletedBookChange(db, sourceRow);
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
      true
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

export const copyBookToCompletedByExternalId = (
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
  return copyBookRowToCompleted(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const clearCompletedBookTrackingItem = (db: Database.Database, row: CollectionItemRow): boolean => {
  if (row.content_type !== 'book') return false;
  db.prepare('UPDATE collection_item_tracker_state SET completed_at = NULL WHERE item_id = ?').run(row.id);
  return true;
};

export const deleteCompletedBookByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): boolean => {
  const existingItem = findCollectionItemByExternalId(db, usernameHash, externalProvider, externalItemId, 'tracking');
  if (!existingItem) return false;
  return clearCompletedBookTrackingItem(db, existingItem);
};

export const markAllBooksAsCompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
           AND content_type = 'book'
           AND NOT EXISTS (
             SELECT 1 FROM collection_items book_tracker
             INNER JOIN collection_item_tracker_state book_tracker_state
               ON book_tracker_state.item_id = book_tracker.id
              AND book_tracker_state.completed_at IS NOT NULL
             WHERE book_tracker.username_hash = ?
              AND (
                (book_tracker.canonical_item_id IS NOT NULL AND book_tracker.canonical_item_id = collection_items.canonical_item_id)
                OR (book_tracker.external_provider = collection_items.external_provider AND book_tracker.external_item_id = collection_items.external_item_id)
              )
              AND book_tracker.list_type = ?
           )`
    )
    .all(sourceOwnerHash, 'books', usernameHash, 'tracking') as CollectionItemRow[];

  void debugLog(
    `markAllBooksAsCompleted candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      copyBookRowToCompleted(db, usernameHash, sourceOwnerHash, row, 'books', false);
    }
  });
  transaction();
  return rows.length;
};

export const markAllBooksAsUncompleted = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection('book_tracker')} FROM collection_items book_tracker
       INNER JOIN collection_item_tracker_state book_tracker_state
         ON book_tracker_state.item_id = book_tracker.id
        AND book_tracker_state.completed_at IS NOT NULL
       WHERE book_tracker.username_hash = ?
         AND book_tracker.list_type = ?
         AND book_tracker.content_type = 'book'
           AND EXISTS (
             SELECT 1 FROM collection_items library_item
             WHERE library_item.username_hash = ?
              AND (
                (library_item.canonical_item_id IS NOT NULL AND library_item.canonical_item_id = book_tracker.canonical_item_id)
                OR (library_item.external_provider = book_tracker.external_provider AND library_item.external_item_id = book_tracker.external_item_id)
              )
              AND library_item.list_type = ?
           )`
    )
    .all(usernameHash, 'tracking', sourceOwnerHash, 'books') as CollectionItemRow[];

  void debugLog(
    `markAllBooksAsUncompleted candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      clearCompletedBookTrackingItem(db, row);
    }
  });
  transaction();
  return rows.length;
};
