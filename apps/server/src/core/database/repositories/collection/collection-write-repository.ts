import { COMPLETED_TAG } from '@shared/constants/tags-const';
import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import Database from 'better-sqlite3';
import { getItemHash } from '../../../utils/collection-item-util';
import { findSeriesTrackerSeasons } from '../series-tracker-season-repository';
import { findWatchedEpisodes } from '../series-tracker-watched-episodes-repository';
import { toApiItem } from './collection-mapper';
import { normalizeListType } from './collection-query';
import { findCollectionItemByImdbId } from './collection-read-repository';

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
  db.prepare('DELETE FROM collection_items WHERE id = ?').run(existingItem.id);
};

export const deleteCollectionItemsByUser = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM collection_items WHERE username_hash = ?').run(usernameHash);
};

export const collectionItemExistsByImdbId = (db: Database.Database, usernameHash: string, imdbId: string): boolean => {
  return Boolean(
    db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? LIMIT 1')
      .get(usernameHash, imdbId)
  );
};

export const syncSeriesTrackerCompletedTag = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): CollectionItemApiModel | undefined => {
  const row = findCollectionItemByImdbId(db, usernameHash, imdbId, 'series-tracker');
  if (!row) return;

  const seasons = findSeriesTrackerSeasons(db, usernameHash, imdbId);
  const watchedEpisodes = findWatchedEpisodes(db, usernameHash, imdbId);
  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }
  const completed =
    availableEpisodes.size > 0 &&
    watchedEpisodes.length === availableEpisodes.size &&
    watchedEpisodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
  const item = toApiItem(db, row);
  const hasCompletedTag = item.tags.includes(COMPLETED_TAG);
  if (completed === hasCompletedTag) return item;

  if (completed) {
    db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(row.id, COMPLETED_TAG);
  } else {
    db.prepare('DELETE FROM collection_item_tags WHERE item_id = ? AND tag = ?').run(row.id, COMPLETED_TAG);
  }

  const syncedItem = toApiItem(db, row);
  const hash = getItemHash(toCollectionItemChange(syncedItem));
  db.prepare('UPDATE collection_items SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hash,
    row.id
  );
  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, imdbId, 'series-tracker')!);
};
