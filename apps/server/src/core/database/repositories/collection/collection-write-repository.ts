import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import Database from 'better-sqlite3';
import { getItemHash } from '../../../utils/collection-item-util';
import {
  deleteExternalItemIdentitiesForCanonicalItemId,
  resolveCanonicalItemId,
  upsertExternalItemIdentities,
} from '../external-item-identity-repository';
import { findTrackingSeasons, findTrackingSeasonsByExternalId } from '../tracking-season-repository';
import { findCompletedEpisodes, findCompletedEpisodesByExternalId } from '../series-completed-episodes-repository';
import { toApiItem } from './collection-mapper';
import { normalizeListType } from './collection-query';
import {
  findCollectionItemByExternalId,
  findCollectionItemByExternalIdOrCanonicalItemId,
  findCollectionItemByImdbId,
} from './collection-read-repository';
import { CollectionItemRow } from './collection-model';

const isCompleteProgress = (progressCurrent: number | null | undefined, progressTotal: number | null | undefined) =>
  typeof progressCurrent === 'number' &&
  typeof progressTotal === 'number' &&
  progressTotal >= 1 &&
  progressCurrent === progressTotal;

const isIncompleteProgress = (progressCurrent: number | null | undefined, progressTotal: number | null | undefined) =>
  typeof progressCurrent === 'number' &&
  typeof progressTotal === 'number' &&
  progressTotal >= 1 &&
  progressCurrent < progressTotal;

const countCollectionItemsByCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemId: string | null
): number => {
  if (!canonicalItemId) return 0;
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM collection_items WHERE username_hash = ? AND canonical_item_id = ?')
    .get(usernameHash, canonicalItemId) as { count: number };
  return row.count;
};

const getExternalIdentities = (item: CollectionItemChangeApiModel): ExternalItemIdentityModel[] => {
  const externalIdentities = [...(item.externalIds ?? [])];
  if (item.IMDbId) externalIdentities.push({ source: 'imdb', id: item.IMDbId });
  return externalIdentities;
};

const replaceExternalRatings = (db: Database.Database, itemId: number, item: CollectionItemChangeApiModel): void => {
  db.prepare('DELETE FROM collection_item_external_ratings WHERE item_id = ?').run(itemId);
  const insertRating = db.prepare(
    'INSERT INTO collection_item_external_ratings (item_id, source, value) VALUES (?, ?, ?)'
  );
  for (const [source, value] of [
    ['imdb', item.rate],
    ['rotten-tomatoes', item.rottenTomatoesRate],
    ['metacritic', item.metacriticRate],
  ] as const) {
    if (value.trim()) insertRating.run(itemId, source, value);
  }
};

const replaceItemRelations = (db: Database.Database, itemId: number, item: CollectionItemChangeApiModel): void => {
  db.prepare('DELETE FROM collection_item_genres WHERE item_id = ?').run(itemId);
  db.prepare('DELETE FROM collection_item_tags WHERE item_id = ?').run(itemId);
  const insertGenre = db.prepare('INSERT OR IGNORE INTO collection_item_genres (item_id, genre) VALUES (?, ?)');
  const insertTag = db.prepare('INSERT OR IGNORE INTO collection_item_tags (item_id, tag) VALUES (?, ?)');
  for (const genre of item.genre) insertGenre.run(itemId, genre);
  for (const tag of item.tags) insertTag.run(itemId, tag);
};

export const insertCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  hash: string,
  item: CollectionItemChangeApiModel,
  listType: CollectionListTypeModel = 'library',
  watchedAt?: string | null,
  canonicalItemIdOverride?: string,
  progressCurrent?: number | null,
  progressTotal?: number | null,
  markCompleted = false
): CollectionItemApiModel => {
  const normalizedListType = normalizeListType(listType);
  return db.transaction(() => {
    const externalIdentities = getExternalIdentities(item);
    const canonicalItemId =
      canonicalItemIdOverride ??
      resolveCanonicalItemId(db, usernameHash, item.externalProvider, item.externalItemId, externalIdentities);
    const result = db
      .prepare(
        `INSERT INTO collection_items
         (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, favorite, title, title_lower, year, user_rate, contributors, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        usernameHash,
        item.externalProvider,
        item.externalItemId,
        canonicalItemId,
        normalizedListType,
        item.contentType,
        item.favorite ? 1 : 0,
        item.title,
        item.title.toLowerCase(),
        item.year ?? '',
        item.userRate,
        item.actors,
        item.plot,
        item.image,
        hash
      );

    const itemId = Number(result.lastInsertRowid);
    replaceExternalRatings(db, itemId, item);
    if (normalizedListType === 'tracking') {
      const autoComplete =
        (markCompleted ||
          item.contentType === 'movie' ||
          ((item.contentType === 'book' || item.contentType === 'album') &&
            isCompleteProgress(progressCurrent, progressTotal))) &&
        !watchedAt;
      db.prepare(
        `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
         VALUES (?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE ? END, ?, ?)`
      ).run(itemId, autoComplete ? 1 : 0, watchedAt ?? null, progressCurrent ?? null, progressTotal ?? null);
    }
    upsertExternalItemIdentities(
      db,
      usernameHash,
      canonicalItemId,
      item.externalProvider,
      item.externalItemId,
      externalIdentities
    );
    replaceItemRelations(db, itemId, item);

    return toApiItem(
      db,
      findCollectionItemByExternalId(db, usernameHash, item.externalProvider, item.externalItemId, normalizedListType)!
    );
  })();
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
  return existingItem
    ? updateCollectionItemByRow(db, usernameHash, existingItem, hash, updatedItem, normalizedListType)
    : undefined;
};

export const updateCollectionItemByRow = (
  db: Database.Database,
  usernameHash: string,
  existingItem: CollectionItemRow,
  hash: string,
  updatedItem: CollectionItemChangeApiModel,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel | undefined => {
  const normalizedListType = normalizeListType(listType);
  return db.transaction(() => {
    const externalIdentities = getExternalIdentities(updatedItem);
    const existingCanonicalItemUseCount = countCollectionItemsByCanonicalItemId(
      db,
      usernameHash,
      existingItem.canonical_item_id
    );
    const canonicalItemId = resolveCanonicalItemId(
      db,
      usernameHash,
      updatedItem.externalProvider,
      updatedItem.externalItemId,
      externalIdentities
    );

    db.prepare(
      `UPDATE collection_items SET
       external_provider = ?, external_item_id = ?, canonical_item_id = ?, content_type = ?, favorite = ?, title = ?, title_lower = ?, year = ?, user_rate = ?, contributors = ?, description = ?, image = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      updatedItem.externalProvider,
      updatedItem.externalItemId,
      canonicalItemId,
      updatedItem.contentType,
      updatedItem.favorite ? 1 : 0,
      updatedItem.title,
      updatedItem.title.toLowerCase(),
      updatedItem.year ?? '',
      updatedItem.userRate,
      updatedItem.actors,
      updatedItem.plot,
      updatedItem.image,
      hash,
      existingItem.id
    );

    replaceExternalRatings(db, existingItem.id, updatedItem);
    replaceItemRelations(db, existingItem.id, updatedItem);
    if (
      normalizedListType === 'tracking' &&
      (updatedItem.progressCurrent !== undefined || updatedItem.progressTotal !== undefined)
    ) {
      const completeProgress =
        (updatedItem.contentType === 'book' || updatedItem.contentType === 'album') &&
        isCompleteProgress(updatedItem.progressCurrent, updatedItem.progressTotal);
      const incompleteProgress =
        (updatedItem.contentType === 'book' || updatedItem.contentType === 'album') &&
        isIncompleteProgress(updatedItem.progressCurrent, updatedItem.progressTotal);
      db.prepare(
        `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
         VALUES (?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET
           progress_current = excluded.progress_current,
           progress_total = excluded.progress_total,
           completed_at = CASE
             WHEN ? THEN COALESCE(collection_item_tracker_state.completed_at, CURRENT_TIMESTAMP)
             WHEN ? THEN NULL
             ELSE collection_item_tracker_state.completed_at
           END`
      ).run(
        existingItem.id,
        completeProgress ? 1 : 0,
        updatedItem.progressCurrent ?? null,
        updatedItem.progressTotal ?? null,
        completeProgress ? 1 : 0,
        incompleteProgress ? 1 : 0
      );
    }
    if (existingCanonicalItemUseCount === 1) {
      deleteExternalItemIdentitiesForCanonicalItemId(db, usernameHash, existingItem.canonical_item_id);
    }
    upsertExternalItemIdentities(
      db,
      usernameHash,
      canonicalItemId,
      updatedItem.externalProvider,
      updatedItem.externalItemId,
      externalIdentities
    );

    return toApiItem(
      db,
      findCollectionItemByExternalId(
        db,
        usernameHash,
        updatedItem.externalProvider,
        updatedItem.externalItemId,
        normalizedListType
      )!
    );
  })();
};

export const updateCollectionItemByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  hash: string,
  updatedItem: CollectionItemChangeApiModel,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel | undefined => {
  const normalizedListType = normalizeListType(listType);
  const existingItem = findCollectionItemByExternalId(
    db,
    usernameHash,
    externalProvider,
    externalItemId,
    normalizedListType
  );
  return existingItem
    ? updateCollectionItemByRow(db, usernameHash, existingItem, hash, updatedItem, normalizedListType)
    : undefined;
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
  if (countCollectionItemsByCanonicalItemId(db, usernameHash, existingItem.canonical_item_id) === 0) {
    deleteExternalItemIdentitiesForCanonicalItemId(db, usernameHash, existingItem.canonical_item_id);
  }
};

export const deleteCollectionItemByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  listType: CollectionListTypeModel = 'library'
): void => {
  const existingItem = findCollectionItemByExternalId(db, usernameHash, externalProvider, externalItemId, listType);
  if (!existingItem) return;

  db.prepare('DELETE FROM collection_item_genres WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_item_tags WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_items WHERE id = ?').run(existingItem.id);
  if (countCollectionItemsByCanonicalItemId(db, usernameHash, existingItem.canonical_item_id) === 0) {
    deleteExternalItemIdentitiesForCanonicalItemId(db, usernameHash, existingItem.canonical_item_id);
  }
};

export const deleteCollectionItemsByUser = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM external_item_identities WHERE username_hash = ?').run(usernameHash);
  db.prepare('DELETE FROM collection_items WHERE username_hash = ?').run(usernameHash);
};

export const collectionItemExistsByImdbId = (db: Database.Database, usernameHash: string, imdbId: string): boolean => {
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM collection_items
         WHERE username_hash = ?
           AND (
             (external_provider = 'imdb' AND external_item_id = ?)
             OR EXISTS (
               SELECT 1 FROM external_item_identities imdb_identity
               WHERE imdb_identity.username_hash = collection_items.username_hash
                 AND imdb_identity.canonical_item_id = collection_items.canonical_item_id
                 AND imdb_identity.external_provider = 'imdb'
                 AND imdb_identity.external_item_id = ?
             )
           )
         LIMIT 1`
      )
      .get(usernameHash, imdbId, imdbId)
  );
};

export const collectionItemExistsByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  listType?: CollectionListTypeModel
): boolean => {
  const normalizedListType = listType ? normalizeListType(listType) : undefined;
  const row = normalizedListType
    ? db
        .prepare(
          'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ? LIMIT 1'
        )
        .get(usernameHash, externalProvider, externalItemId, normalizedListType)
    : db
        .prepare(
          'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? LIMIT 1'
        )
        .get(usernameHash, externalProvider, externalItemId);
  return Boolean(row);
};

export const syncTrackingCompletedTag = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): CollectionItemApiModel | undefined => {
  const row = findCollectionItemByImdbId(db, usernameHash, imdbId, 'tracking');
  if (!row) return;

  const seasons = findTrackingSeasons(db, usernameHash, imdbId);
  const completedEpisodes = findCompletedEpisodes(db, usernameHash, imdbId);
  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }
  const completed =
    availableEpisodes.size > 0 &&
    completedEpisodes.length === availableEpisodes.size &&
    completedEpisodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
  const item = toApiItem(db, row);
  if ((completed && row.watched_at) || (!completed && !row.watched_at)) return item;

  if (completed) {
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at)
       VALUES (?, CURRENT_TIMESTAMP)
       ON CONFLICT(item_id) DO UPDATE SET completed_at = COALESCE(completed_at, excluded.completed_at)`
    ).run(row.id);
  } else {
    db.prepare('UPDATE collection_item_tracker_state SET completed_at = NULL WHERE item_id = ?').run(row.id);
  }

  const refreshedRow = findCollectionItemByImdbId(db, usernameHash, imdbId, 'tracking')!;
  const syncedItem = toApiItem(db, refreshedRow);
  const hash = getItemHash(toCollectionItemChange(syncedItem));
  db.prepare('UPDATE collection_items SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hash,
    row.id
  );
  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, imdbId, 'tracking')!);
};

export const syncTrackingCompletedTagByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string
): CollectionItemApiModel | undefined => {
  const row = findCollectionItemByExternalIdOrCanonicalItemId(
    db,
    usernameHash,
    externalProvider,
    externalItemId,
    'tracking'
  );
  if (!row) return;

  const seasons = findTrackingSeasonsByExternalId(db, usernameHash, externalProvider, externalItemId);
  const completedEpisodes = findCompletedEpisodesByExternalId(db, usernameHash, externalProvider, externalItemId);
  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }
  const completed =
    availableEpisodes.size > 0 &&
    completedEpisodes.length === availableEpisodes.size &&
    completedEpisodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
  const item = toApiItem(db, row);
  if ((completed && row.watched_at) || (!completed && !row.watched_at)) return item;

  if (completed) {
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at)
       VALUES (?, CURRENT_TIMESTAMP)
       ON CONFLICT(item_id) DO UPDATE SET completed_at = COALESCE(completed_at, excluded.completed_at)`
    ).run(row.id);
  } else {
    db.prepare('UPDATE collection_item_tracker_state SET completed_at = NULL WHERE item_id = ?').run(row.id);
  }

  const refreshedRow = findCollectionItemByExternalIdOrCanonicalItemId(
    db,
    usernameHash,
    externalProvider,
    externalItemId,
    'tracking'
  )!;
  const syncedItem = toApiItem(db, refreshedRow);
  const hash = getItemHash(toCollectionItemChange(syncedItem));
  db.prepare('UPDATE collection_items SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hash,
    row.id
  );
  return toApiItem(
    db,
    findCollectionItemByExternalIdOrCanonicalItemId(db, usernameHash, externalProvider, externalItemId, 'tracking')!
  );
};
