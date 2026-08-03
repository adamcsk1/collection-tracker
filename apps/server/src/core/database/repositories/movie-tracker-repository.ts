import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import Database from 'better-sqlite3';
import { debugLog } from '../../logger';
import { getItemHash } from '../../utils/collection-item-util';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
  findCollectionItemByImdbId,
} from './collection/collection-read-repository';
import {
  deleteCollectionItem,
  deleteCollectionItemByExternalId,
  insertCollectionItem,
} from './collection/collection-write-repository';
import { toApiItem } from './collection/collection-mapper';
import { collectionItemProjection, CollectionItemRow } from './collection/collection-model';
import { deleteUnreferencedExternalItemIdentities, resolveCanonicalItemId } from './external-item-identity-repository';

const movieContentCondition = `content_type = 'movie'`;

const toMovieTrackerChange = (db: Database.Database, row: CollectionItemRow): CollectionItemChangeApiModel | null => {
  const sourceItem = toApiItem(db, row, row.username_hash);
  if (sourceItem.contentType !== 'movie') return null;
  const item = toCollectionItemChange(sourceItem);
  item.favorite = false;
  return item;
};

export const copyLibraryMovieToMovieTracker = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  imdbId: string
): CollectionItemApiModel | null =>
  copyMovieToMovieTracker(db, usernameHash, sourceOwnerHash, imdbId, 'library', false);

const copyMovieRowToMovieTracker = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  sourceRow: CollectionItemRow,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const trackerItem =
    (sourceRow.canonical_item_id
      ? findCollectionItemByCanonicalItemId(db, usernameHash, sourceRow.canonical_item_id, 'movie-tracker')
      : undefined) ??
    findCollectionItemByExternalId(
      db,
      usernameHash,
      sourceRow.external_provider,
      sourceRow.external_item_id ?? '',
      'movie-tracker'
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

  const item = toMovieTrackerChange(db, sourceRow);
  if (!item) return null;
  const transaction = db.transaction(() => {
    const insertedItem = insertCollectionItem(db, usernameHash, getItemHash(item), item, 'movie-tracker');
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

export const copyMovieToMovieTracker = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash: string,
  imdbId: string,
  sourceListType: CollectionListTypeModel,
  deleteSource = false
): CollectionItemApiModel | null => {
  const sourceRow = findCollectionItemByImdbId(db, sourceOwnerHash, imdbId, sourceListType);
  if (!sourceRow) return null;
  return copyMovieRowToMovieTracker(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const copyMovieToMovieTrackerByExternalId = (
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
  return copyMovieRowToMovieTracker(db, usernameHash, sourceOwnerHash, sourceRow, sourceListType, deleteSource);
};

export const deleteMovieTrackerItem = (db: Database.Database, usernameHash: string, imdbId: string): boolean => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId, 'movie-tracker');
  if (!existingItem) return false;
  deleteCollectionItem(db, usernameHash, imdbId, 'movie-tracker');
  return true;
};

export const deleteMovieTrackerItemByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): boolean => {
  const existingItem = findCollectionItemByExternalId(
    db,
    usernameHash,
    externalProvider,
    externalItemId,
    'movie-tracker'
  );
  if (!existingItem) return false;
  deleteCollectionItemByExternalId(db, usernameHash, externalProvider, externalItemId, 'movie-tracker');
  return true;
};

export const deleteAllMovieTrackerItems = (db: Database.Database, usernameHash: string): number => {
  const deletedCanonicalItemIds = db
    .prepare('SELECT canonical_item_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .all(usernameHash, 'movie-tracker') as Array<{ canonical_item_id: string | null }>;
  const result = db
    .prepare('DELETE FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .run(usernameHash, 'movie-tracker');
  deleteUnreferencedExternalItemIdentities(
    db,
    usernameHash,
    deletedCanonicalItemIds.map((row) => row.canonical_item_id)
  );
  return result.changes;
};

export const markAllMoviesAsWatched = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
           AND ${movieContentCondition}
           AND NOT EXISTS (
             SELECT 1 FROM collection_items movie_tracker
             WHERE movie_tracker.username_hash = ?
              AND (
                (movie_tracker.canonical_item_id IS NOT NULL AND movie_tracker.canonical_item_id = collection_items.canonical_item_id)
                OR (movie_tracker.external_provider = collection_items.external_provider AND movie_tracker.external_item_id = collection_items.external_item_id)
              )
              AND movie_tracker.list_type = ?
           )`
    )
    .all(sourceOwnerHash, 'library', usernameHash, 'movie-tracker') as CollectionItemRow[];

  void debugLog(
    `markAllMoviesAsWatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      copyMovieRowToMovieTracker(db, usernameHash, sourceOwnerHash, row, 'library', false);
    }
  });
  transaction();
  return rows.length;
};

export const markAllMoviesAsUnwatched = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): number => {
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection('movie_tracker')} FROM collection_items movie_tracker
       WHERE movie_tracker.username_hash = ?
         AND movie_tracker.list_type = ?
           AND EXISTS (
             SELECT 1 FROM collection_items library_item
             WHERE library_item.username_hash = ?
              AND (
                (library_item.canonical_item_id IS NOT NULL AND library_item.canonical_item_id = movie_tracker.canonical_item_id)
                OR (library_item.external_provider = movie_tracker.external_provider AND library_item.external_item_id = movie_tracker.external_item_id)
              )
              AND library_item.list_type = ?
           )`
    )
    .all(usernameHash, 'movie-tracker', sourceOwnerHash, 'library') as CollectionItemRow[];

  void debugLog(
    `markAllMoviesAsUnwatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      deleteCollectionItemByExternalId(
        db,
        usernameHash,
        row.external_provider,
        row.external_item_id ?? '',
        'movie-tracker'
      );
    }
  });
  transaction();
  return rows.length;
};
