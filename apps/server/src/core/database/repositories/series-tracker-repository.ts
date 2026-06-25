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
import { findCollectionItemByImdbId } from './collection/collection-read-repository';
import { CollectionItemRow } from './collection/collection-types';
import { deleteCollectionItem, insertCollectionItem } from './collection/collection-write-repository';

const seriesContentCondition = `collection_items.content_type = 'series'`;

const librarySeriesContentCondition = `library_item.content_type = 'series'`;

const toSeriesTrackerChange = (db: Database.Database, row: CollectionItemRow): CollectionItemChangeApiModel | null => {
  const sourceItem = toApiItem(db, row, row.username_hash);
  if (sourceItem.contentType !== 'series') return null;
  const item = toCollectionItemChange(sourceItem);
  item.favorite = false;
  return item;
};

export const copySeriesToSeriesTracker = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  imdbId: string,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const sourceRow = findCollectionItemByImdbId(db, sourceOwnerHash, imdbId, sourceListType);
  if (!sourceRow) return null;
  const trackerItem = findCollectionItemByImdbId(db, usernameHash, imdbId, 'series-tracker');
  if (trackerItem) {
    if (deleteSource) deleteCollectionItem(db, sourceOwnerHash, imdbId, sourceListType);
    return toApiItem(db, trackerItem, usernameHash);
  }

  const item = toSeriesTrackerChange(db, sourceRow);
  if (!item) return null;
  const transaction = db.transaction(() => {
    const insertedItem = insertCollectionItem(db, usernameHash, getItemHash(item), item, 'series-tracker');
    if (deleteSource) deleteCollectionItem(db, sourceOwnerHash, imdbId, sourceListType);
    return insertedItem;
  });
  return transaction();
};

export const markAllSeriesAsWatched = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
           AND ${seriesContentCondition}
         AND NOT EXISTS (
           SELECT 1 FROM collection_items series_tracker
           WHERE series_tracker.username_hash = ?
             AND series_tracker.imdb_id = collection_items.imdb_id
             AND series_tracker.list_type = ?
         )`
    )
    .all(sourceOwnerHash, 'library', usernameHash, 'series-tracker') as CollectionItemRow[];

  void debugLog(
    `markAllSeriesAsWatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    const insertedItems: CollectionItemApiModel[] = [];
    for (const row of rows) {
      const item = copySeriesToSeriesTracker(db, usernameHash, sourceOwnerHash, row.imdb_id, 'library', false);
      if (item) insertedItems.push(item);
    }
    return insertedItems;
  });
  return transaction();
};

export const findSeriesTrackerItemsForLibrarySeries = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT series_tracker.* FROM collection_items series_tracker
       WHERE series_tracker.username_hash = ?
         AND series_tracker.list_type = ?
         AND EXISTS (
           SELECT 1 FROM collection_items library_item
           WHERE library_item.username_hash = ?
             AND library_item.imdb_id = series_tracker.imdb_id
             AND library_item.list_type = ?
               AND ${librarySeriesContentCondition}
           )`
    )
    .all(usernameHash, 'series-tracker', sourceOwnerHash, 'library') as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row, usernameHash));
};

export const findOwnSeriesTrackerItems = (db: Database.Database, usernameHash: string): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?`
    )
    .all(usernameHash, 'series-tracker') as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row, usernameHash));
};

export const deleteAllSeriesTrackerItems = (db: Database.Database, usernameHash: string): number => {
  const result = db
    .prepare('DELETE FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .run(usernameHash, 'series-tracker');
  return result.changes;
};
