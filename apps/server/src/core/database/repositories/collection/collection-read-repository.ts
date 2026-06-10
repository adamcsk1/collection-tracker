import {
  CollectionItemApiModel,
  CollectionListTypeModel,
  CollectionItemsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { toApiItem } from './collection-mapper';
import { buildItemWhere, normalizeLimit, normalizeListType, normalizeOffset } from './collection-query';
import { CollectionItemQueryOptions, CollectionItemRow } from './collection-types';

export const findCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  offset: number,
  limit: number,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel[] => {
  const normalizedListType = normalizeListType(listType);
  const rows = db
    .prepare(
      `SELECT *
        FROM collection_items
        WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...usernameHashes, normalizedListType, limit, offset) as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row));
};

export const searchCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  options: CollectionItemQueryOptions
): CollectionItemsApiResponseModel => {
  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit);
  const queryParts = buildItemWhere(usernameHashes, options.filters, options.matchedImdbIds);
  const whereSql = queryParts.where.join(' AND ');

  if (options.matchedImdbIds?.length === 0) {
    return { items: [], total: 0, offset, limit };
  }

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM collection_items WHERE ${whereSql}`).get(...queryParts.params) as {
      count: number;
    }
  ).count;

  if (options.matchedImdbIds?.length) {
    const rows = db
      .prepare(
        `SELECT *
         FROM collection_items
         WHERE ${whereSql}`
      )
      .all(...queryParts.params) as CollectionItemRow[];
    const rankByImdbId = new Map(options.matchedImdbIds.map((imdbId, index) => [imdbId, index]));
    const items = rows
      .sort((firstItem, secondItem) => rankByImdbId.get(firstItem.imdb_id)! - rankByImdbId.get(secondItem.imdb_id)!)
      .slice(offset, offset + limit)
      .map((row) => toApiItem(db, row));

    return { items, total, offset, limit };
  }

  const rows = db
    .prepare(
      `SELECT *
       FROM collection_items
       WHERE ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...queryParts.params, limit, offset) as CollectionItemRow[];

  return { items: rows.map((row) => toApiItem(db, row)), total, offset, limit };
};

export const collectionItemExistsInList = (
  db: Database.Database,
  usernameHashes: string[],
  imdbId: string,
  listType: CollectionListTypeModel = 'library'
): boolean => {
  const row = db
    .prepare(
      `SELECT 1 FROM collection_items WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')}) AND imdb_id = ? AND list_type = ? LIMIT 1`
    )
    .get(...usernameHashes, imdbId, normalizeListType(listType));
  return !!row;
};

export const findCollectionItemsForPrompt = (
  db: Database.Database,
  usernameHashes: string[]
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT *
        FROM collection_items
        WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(...usernameHashes, 'library') as CollectionItemRow[];

  return rows.reduce<CollectionItemApiModel[]>((items, row) => {
    if (!row.imdb_id) return items;
    const apiItem = toApiItem(db, row);
    items.push(apiItem);
    return items;
  }, []);
};

export const findRandomCollectionItem = (
  db: Database.Database,
  usernameHashes: string[]
): CollectionItemApiModel | undefined => {
  const row = db
    .prepare(
      `SELECT * FROM collection_items
        WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
        ORDER BY RANDOM() LIMIT 1`
    )
    .get(...usernameHashes, 'library') as CollectionItemRow | undefined;

  return row ? toApiItem(db, row) : undefined;
};

export const findRandomCollectionImages = (
  db: Database.Database,
  usernameHashes: string[],
  count: number
): string[] => {
  const rows = db
    .prepare(
      `SELECT image FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')}) AND image != ?
         AND list_type = ?
        ORDER BY RANDOM() LIMIT ?`
    )
    .all(...usernameHashes, '', 'library', count) as Array<{ image: string }>;

  return rows.map((row) => row.image);
};

export const countCollectionItems = (db: Database.Database, usernameHashes: string[]): number => {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?`
    )
    .get(...usernameHashes, 'library') as { count: number };
  return row.count;
};

export const findCollectionItemByImdbId = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  listType: CollectionListTypeModel = 'library'
): CollectionItemRow | undefined => {
  return db
    .prepare('SELECT * FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
    .get(usernameHash, imdbId, normalizeListType(listType)) as CollectionItemRow | undefined;
};

export const findAllCollectionItemsByUser = (db: Database.Database, usernameHash: string): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
       ORDER BY list_type, created_at DESC, id DESC`
    )
    .all(usernameHash) as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row));
};
