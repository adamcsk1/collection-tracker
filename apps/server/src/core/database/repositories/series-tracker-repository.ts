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
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
  findCollectionItemByImdbId,
} from './collection/collection-read-repository';
import { collectionItemProjection, CollectionItemRow } from './collection/collection-model';
import { deleteCollectionItemByExternalId, insertCollectionItem } from './collection/collection-write-repository';
import { deleteUnreferencedExternalItemIdentities, resolveCanonicalItemId } from './external-item-identity-repository';

const seriesContentCondition = `collection_items.content_type = 'series'`;

const librarySeriesContentCondition = `library_item.content_type = 'series'`;

const toTrackingChange = (db: Database.Database, row: CollectionItemRow): CollectionItemChangeApiModel | null => {
  const sourceItem = toApiItem(db, row, row.username_hash);
  if (sourceItem.contentType !== 'series' && sourceItem.contentType !== 'book') return null;
  const item = toCollectionItemChange(sourceItem);
  item.favorite = false;
  return item;
};

const copySeriesRowToTracking = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  sourceRow: CollectionItemRow,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
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
    if (deleteSource) {
      deleteCollectionItemByExternalId(
        db,
        sourceOwnerHash,
        sourceRow.external_provider,
        sourceRow.external_item_id ?? '',
        sourceListType
      );
    }
    return toApiItem(db, trackerItem, usernameHash);
  }

  const item = toTrackingChange(db, sourceRow);
  if (!item) return null;
  const transaction = db.transaction(() => {
    const insertedItem = insertCollectionItem(db, usernameHash, getItemHash(item), item, 'tracking');
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

export const copySeriesToTracking = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  imdbId: string,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const sourceRow = findCollectionItemByImdbId(db, sourceOwnerHash, imdbId, sourceListType);
  if (!sourceRow) return null;
  return copySeriesRowToTracking(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const copySeriesToTrackingByExternalId = (
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
  return copySeriesRowToTracking(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const markAllSeriesAsWatched = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
           AND ${seriesContentCondition}
          AND NOT EXISTS (
            SELECT 1 FROM collection_items series_tracker
            WHERE series_tracker.username_hash = ?
               AND (
                 (series_tracker.canonical_item_id IS NOT NULL AND series_tracker.canonical_item_id = collection_items.canonical_item_id)
                 OR (series_tracker.external_provider = collection_items.external_provider AND series_tracker.external_item_id = collection_items.external_item_id)
               )
               AND series_tracker.list_type = ?
          )`
    )
    .all(sourceOwnerHash, 'library', usernameHash, 'tracking') as CollectionItemRow[];

  void debugLog(
    `markAllSeriesAsWatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    const insertedItems: CollectionItemApiModel[] = [];
    for (const row of rows) {
      const item = copySeriesRowToTracking(db, usernameHash, sourceOwnerHash, row, 'library', false);
      if (item) insertedItems.push(item);
    }
    return insertedItems;
  });
  return transaction();
};

export const findTrackingItemsForLibrarySeries = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection('series_tracker')} FROM collection_items series_tracker
       WHERE series_tracker.username_hash = ?
         AND series_tracker.list_type = ?
          AND EXISTS (
            SELECT 1 FROM collection_items library_item
            WHERE library_item.username_hash = ?
               AND (
                 (library_item.canonical_item_id IS NOT NULL AND library_item.canonical_item_id = series_tracker.canonical_item_id)
                 OR (library_item.external_provider = series_tracker.external_provider AND library_item.external_item_id = series_tracker.external_item_id)
               )
               AND library_item.list_type = ?
                AND ${librarySeriesContentCondition}
            )`
    )
    .all(usernameHash, 'tracking', sourceOwnerHash, 'library') as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row, usernameHash));
};

export const findOwnTrackingItems = (db: Database.Database, usernameHash: string): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?`
    )
    .all(usernameHash, 'tracking') as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row, usernameHash));
};

export const deleteAllTrackingItems = (db: Database.Database, usernameHash: string): number => {
  const deletedCanonicalItemIds = db
    .prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .all(usernameHash, 'tracking') as Array<{ canonical_item_id: string | null }>;
  const result = db
    .prepare('DELETE FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .run(usernameHash, 'tracking');
  deleteUnreferencedExternalItemIdentities(
    db,
    usernameHash,
    deletedCanonicalItemIds.map((row) => row.canonical_item_id)
  );
  return result.changes;
};
