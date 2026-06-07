import { WATCHED_TAG } from '@shared/constants/tags-const';
import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { getItemHash } from '../../../utils/collection-item-util';
import { deleteSeriesTrackerSeasons } from '../series-tracker-season-repository';
import { toApiItem } from './collection-mapper';
import { normalizeListType } from './collection-query';
import { findCollectionItemByImdbId } from './collection-read-repository';
import { CollectionItemRow } from './collection-types';

export const insertCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  hash: string,
  item: CollectionItemChangeApiModel,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel => {
  const result = db
    .prepare(
      `INSERT INTO collection_items
       (username_hash, imdb_id, list_type, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, user_rate, actors, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      item.IMDbId,
      normalizeListType(listType),
      item.title,
      item.title.toLowerCase(),
      item.year ?? '',
      item.rate,
      item.rottenTomatoesRate,
      item.metacriticRate,
      item.userRate,
      item.actors,
      item.plot,
      item.image,
      hash
    );

  const itemId = Number(result.lastInsertRowid);

  for (const genre of item.genre) {
    db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, genre);
  }

  for (const tag of item.tags) {
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }

  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, item.IMDbId, listType)!);
};

export const updateCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  hash: string,
  updatedItem: CollectionItemChangeApiModel,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel | undefined => {
  const normalizedListType = normalizeListType(listType);
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId, normalizedListType);
  if (!existingItem) return;

  db.prepare(
    `UPDATE collection_items SET
     imdb_id = ?, title = ?, title_lower = ?, year = ?, rate = ?, rotten_tomatoes_rate = ?, metacritic_rate = ?, user_rate = ?, actors = ?, plot = ?, image = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  ).run(
    updatedItem.IMDbId,
    updatedItem.title,
    updatedItem.title.toLowerCase(),
    updatedItem.year ?? '',
    updatedItem.rate,
    updatedItem.rottenTomatoesRate,
    updatedItem.metacriticRate,
    updatedItem.userRate,
    updatedItem.actors,
    updatedItem.plot,
    updatedItem.image,
    hash,
    existingItem.id
  );

  db.prepare('DELETE FROM collection_item_genres WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_item_tags WHERE item_id = ?').run(existingItem.id);

  for (const genre of updatedItem.genre) {
    db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(
      existingItem.id,
      genre
    );
  }

  for (const tag of updatedItem.tags) {
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(existingItem.id, tag);
  }

  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, updatedItem.IMDbId, normalizedListType)!);
};

export const deleteCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  listType: CollectionListTypeModel = 'library'
): void => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId, listType);
  if (!existingItem) return;

  db.prepare('DELETE FROM collection_item_genres WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_item_tags WHERE item_id = ?').run(existingItem.id);
  deleteSeriesTrackerSeasons(db, usernameHash, imdbId);
  db.prepare('DELETE FROM collection_items WHERE id = ?').run(existingItem.id);
};

export const markAllAsWatched = (db: Database.Database, usernameHash: string): number => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
        AND list_type = ?
       AND NOT EXISTS (
         SELECT 1 FROM collection_item_tags
         WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
       )`
    )
    .all(usernameHash, 'library', WATCHED_TAG) as CollectionItemRow[];

  let changedCount = 0;
  const transaction = db.transaction(() => {
    for (const row of rows) {
      const item = toApiItem(db, row);
      const updatedItem: CollectionItemChangeApiModel = {
        ...item,
        tags: [...item.tags, WATCHED_TAG],
      };
      const newHash = getItemHash(updatedItem);
      updateCollectionItem(db, usernameHash, item.IMDbId, newHash, updatedItem);
      changedCount++;
    }
  });

  transaction();
  return changedCount;
};

export const markAllAsUnwatched = (db: Database.Database, usernameHash: string): number => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
        AND list_type = ?
       AND EXISTS (
         SELECT 1 FROM collection_item_tags
         WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
       )`
    )
    .all(usernameHash, 'library', WATCHED_TAG) as CollectionItemRow[];

  let changedCount = 0;
  const transaction = db.transaction(() => {
    for (const row of rows) {
      const item = toApiItem(db, row);
      const updatedItem: CollectionItemChangeApiModel = {
        ...item,
        tags: item.tags.filter((tag) => tag !== WATCHED_TAG),
      };
      const newHash = getItemHash(updatedItem);
      updateCollectionItem(db, usernameHash, item.IMDbId, newHash, updatedItem);
      changedCount++;
    }
  });

  transaction();
  return changedCount;
};
