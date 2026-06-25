import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import Database from 'better-sqlite3';
import { debugLog } from '../../logger';
import { getItemHash } from '../../utils/collection-item-util';
import { findCollectionItemByImdbId } from './collection/collection-read-repository';
import { deleteCollectionItem, insertCollectionItem } from './collection/collection-write-repository';
import { toApiItem } from './collection/collection-mapper';
import { CollectionItemRow } from './collection/collection-types';

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
  const trackerItem = findCollectionItemByImdbId(db, usernameHash, imdbId, 'movie-tracker');
  if (trackerItem) {
    if (deleteSource) deleteCollectionItem(db, sourceOwnerHash, imdbId, sourceListType);
    return toApiItem(db, trackerItem, usernameHash);
  }

  const item = toMovieTrackerChange(db, sourceRow);
  if (!item) return null;
  const transaction = db.transaction(() => {
    const insertedItem = insertCollectionItem(db, usernameHash, getItemHash(item), item, 'movie-tracker');
    if (deleteSource) deleteCollectionItem(db, sourceOwnerHash, imdbId, sourceListType);
    return insertedItem;
  });
  return transaction();
};

export const deleteMovieTrackerItem = (db: Database.Database, usernameHash: string, imdbId: string): boolean => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId, 'movie-tracker');
  if (!existingItem) return false;
  deleteCollectionItem(db, usernameHash, imdbId, 'movie-tracker');
  return true;
};

export const deleteAllMovieTrackerItems = (db: Database.Database, usernameHash: string): number => {
  const result = db
    .prepare('DELETE FROM collection_items WHERE username_hash = ? AND list_type = ?')
    .run(usernameHash, 'movie-tracker');
  return result.changes;
};

export const markAllMoviesAsWatched = (
  db: Database.Database,
  usernameHash: string,
  sourceOwnerHash = usernameHash
): number => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
           AND ${movieContentCondition}
          AND NOT EXISTS (
            SELECT 1 FROM collection_items movie_tracker
            WHERE movie_tracker.username_hash = ?
              AND movie_tracker.imdb_id = collection_items.imdb_id
              AND movie_tracker.list_type = ?
          )`
    )
    .all(sourceOwnerHash, 'library', usernameHash, 'movie-tracker') as CollectionItemRow[];

  void debugLog(
    `markAllMoviesAsWatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      copyLibraryMovieToMovieTracker(db, usernameHash, sourceOwnerHash, row.imdb_id);
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
      `SELECT movie_tracker.* FROM collection_items movie_tracker
       WHERE movie_tracker.username_hash = ?
         AND movie_tracker.list_type = ?
          AND EXISTS (
            SELECT 1 FROM collection_items library_item
            WHERE library_item.username_hash = ?
              AND library_item.imdb_id = movie_tracker.imdb_id
              AND library_item.list_type = ?
          )`
    )
    .all(usernameHash, 'movie-tracker', sourceOwnerHash, 'library') as CollectionItemRow[];

  void debugLog(
    `markAllMoviesAsUnwatched candidates: requester=${usernameHash}, sourceOwner=${sourceOwnerHash}, count=${rows.length}`
  );

  const transaction = db.transaction(() => {
    for (const row of rows) {
      deleteCollectionItem(db, usernameHash, row.imdb_id, 'movie-tracker');
    }
  });
  transaction();
  return rows.length;
};
