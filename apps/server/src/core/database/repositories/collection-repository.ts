import {
  FAVORITE_TAG,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  WATCH_LATER_TAG,
  WATCHED_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionItemFiltersApiModel,
  CollectionListTypeModel,
  CollectionItemSuggestionApiModel,
  CollectionItemTagMode,
  CollectionItemsApiResponseModel,
  CollectionStatisticsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { getItemHash } from '../../utils/collection-item-util';
import { getUserShareCode } from './user-repository';

export interface CollectionItemRow {
  id: number;
  username_hash: string;
  imdb_id: string;
  list_type: CollectionListTypeModel;
  title: string;
  title_lower: string;
  year: string;
  rate: string;
  user_rate: number | null;
  actors: string;
  plot: string;
  image: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

interface CollectionItemQueryOptions {
  filters?: CollectionItemFiltersApiModel;
  offset: number;
  limit: number;
  matchedImdbIds?: string[];
}

interface QueryParts {
  where: string[];
  params: Array<string | number>;
}

const INTERNAL_COLLECTION_TAGS = [WATCH_LATER_TAG, WISHLIST_TAG];
const INTERNAL_TAGS = [WATCHED_TAG, FAVORITE_TAG, ...INTERNAL_COLLECTION_TAGS, MOVIE_TAG, SERIES_TAG];
const SUGGESTION_SYSTEM_TAGS = [
  ...VIRTUAL_TAGS,
  WATCHED_TAG,
  FAVORITE_TAG,
  ...INTERNAL_COLLECTION_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
];

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

const normalizeLimit = (limit: number): number => Math.min(Math.max(Math.floor(limit) || 10, 1), 100);

const normalizeOffset = (offset: number): number => Math.max(Math.floor(offset) || 0, 0);

const normalizeListType = (listType: CollectionListTypeModel | undefined): CollectionListTypeModel => {
  if (listType === 'watch-later' || listType === 'wishlist') return listType;
  return 'library';
};

const addTagExists = (queryParts: QueryParts, tag: string, exists = true): void => {
  queryParts.where.push(`${exists ? '' : 'NOT '}EXISTS (
    SELECT 1 FROM collection_item_tags tag_filter
    WHERE tag_filter.item_id = collection_items.id AND LOWER(tag_filter.tag) = ?
  )`);
  queryParts.params.push(tag.toLowerCase());
};

const addGenreExists = (queryParts: QueryParts, genre: string): void => {
  queryParts.where.push(`EXISTS (
    SELECT 1 FROM collection_item_genres genre_filter
    WHERE genre_filter.item_id = collection_items.id AND LOWER(genre_filter.genre) = ?
  )`);
  queryParts.params.push(genre.toLowerCase());
};

const addSearchFilter = (queryParts: QueryParts, search: string): void => {
  const lowerSearch = search.trim().toLowerCase();
  if (!lowerSearch) return;

  const likeSearch = `%${escapeLike(lowerSearch)}%`;
  queryParts.where.push(`(
    collection_items.title_lower LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.imdb_id) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.year) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.rate) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.actors) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.plot) LIKE ? ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM collection_item_tags search_tags
      WHERE search_tags.item_id = collection_items.id AND LOWER(search_tags.tag) LIKE ? ESCAPE '\\'
    )
    OR EXISTS (
      SELECT 1 FROM collection_item_genres search_genres
      WHERE search_genres.item_id = collection_items.id AND LOWER(search_genres.genre) LIKE ? ESCAPE '\\'
    )
  )`);
  queryParts.params.push(
    likeSearch,
    likeSearch,
    likeSearch,
    likeSearch,
    likeSearch,
    likeSearch,
    likeSearch,
    likeSearch
  );
};

const addFilters = (queryParts: QueryParts, filters: CollectionItemFiltersApiModel | undefined): void => {
  const listType = normalizeListType(filters?.listType);
  if (listType === 'library') {
    queryParts.where.push('collection_items.list_type = ?');
    queryParts.params.push(listType);
  } else {
    queryParts.where.push('collection_items.list_type = ?');
    queryParts.params.push(listType);
  }
  if (!filters) return;

  const tags = (filters.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

  addSearchFilter(queryParts, filters.search ?? '');

  if (filters.type === 'movie') addTagExists(queryParts, MOVIE_TAG);
  if (filters.type === 'series') addTagExists(queryParts, SERIES_TAG);
  if (filters.watched === true) addTagExists(queryParts, WATCHED_TAG);
  if (filters.watched === false) addTagExists(queryParts, WATCHED_TAG, false);

  for (const genre of filters.genres ?? []) {
    const normalizedGenre = genre.trim();
    if (normalizedGenre) addGenreExists(queryParts, normalizedGenre);
  }

  const tagMode: CollectionItemTagMode = filters.tagMode ?? 'any';
  if (tags.length === 1 || tagMode === 'all') {
    for (const tag of tags) addTagExists(queryParts, tag);
  } else if (tags.length > 1) {
    queryParts.where.push(`EXISTS (
      SELECT 1 FROM collection_item_tags any_tag_filter
      WHERE any_tag_filter.item_id = collection_items.id
      AND LOWER(any_tag_filter.tag) IN (${tags.map(() => '?').join(', ')})
    )`);
    queryParts.params.push(...tags.map((tag) => tag.toLowerCase()));
  }
};

const buildItemWhere = (
  usernameHashes: string[],
  filters: CollectionItemFiltersApiModel | undefined,
  matchedImdbIds?: string[]
): QueryParts => {
  const queryParts: QueryParts = {
    where: [`collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})`],
    params: [...usernameHashes],
  };
  addFilters(queryParts, filters);

  if (matchedImdbIds?.length) {
    queryParts.where.push(`collection_items.imdb_id IN (${matchedImdbIds.map(() => '?').join(', ')})`);
    queryParts.params.push(...matchedImdbIds);
  }

  return queryParts;
};

const getItemRelations = (db: Database.Database, itemId: number): { genre: string[]; tags: string[] } => ({
  genre: (
    db.prepare('SELECT genre FROM collection_item_genres WHERE item_id = ? ORDER BY genre').all(itemId) as Array<{
      genre: string;
    }>
  ).map((row) => row.genre),
  tags: (
    db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(itemId) as Array<{
      tag: string;
    }>
  ).map((row) => row.tag),
});

export const getCollectionItemTags = (db: Database.Database, itemId: number): string[] => {
  return (
    db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(itemId) as Array<{
      tag: string;
    }>
  ).map((row) => row.tag);
};

export const collectionItemHasTag = (db: Database.Database, itemId: number, tag: string): boolean => {
  return !!db.prepare('SELECT 1 FROM collection_item_tags WHERE item_id = ? AND tag = ?').get(itemId, tag);
};

const toApiItem = (db: Database.Database, row: CollectionItemRow): CollectionItemApiModel => {
  const relations = getItemRelations(db, row.id);
  const item: CollectionItemChangeApiModel = {
    image: row.image,
    title: row.title,
    genre: relations.genre,
    IMDbId: row.imdb_id,
    tags: relations.tags,
    year: row.year ? Number(row.year) : null,
    rate: row.rate,
    userRate: row.user_rate,
    actors: row.actors,
    plot: row.plot,
  };

  return {
    ...item,
    titleLower: row.title_lower,
    hash: row.content_hash,
    listType: row.list_type,
    ownerShareCode: getUserShareCode(row.username_hash),
  };
};

export const findCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  offset: number,
  limit: number,
  listType: CollectionListTypeModel = 'library'
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT *
        FROM collection_items
        WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...usernameHashes, normalizeListType(listType), limit, offset) as CollectionItemRow[];

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

export const findCollectionItemSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number
): CollectionItemSuggestionApiModel[] => {
  const normalizedLimit = normalizeLimit(limit);
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  if (lowerQuery.startsWith('#')) {
    const systemTagSuggestions = SUGGESTION_SYSTEM_TAGS.filter((tag) => tag.startsWith(lowerQuery));
    const remainingLimit = normalizedLimit - systemTagSuggestions.length;
    const customTagSuggestions =
      remainingLimit > 0 ? findTagSuggestions(db, usernameHashes, query, remainingLimit) : [];

    return [...systemTagSuggestions, ...customTagSuggestions]
      .slice(0, normalizedLimit)
      .map((tag) => ({ label: tag, value: tag, kind: 'tag' }));
  }

  const likeQuery = `%${escapeLike(lowerQuery)}%`;
  const rows = db
    .prepare(
      `SELECT imdb_id, title
       FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND list_type = ?
       AND (
         title_lower LIKE ? ESCAPE '\\'
         OR LOWER(imdb_id) LIKE ? ESCAPE '\\'
         OR LOWER(actors) LIKE ? ESCAPE '\\'
         OR LOWER(plot) LIKE ? ESCAPE '\\'
        )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(...usernameHashes, 'library', likeQuery, likeQuery, likeQuery, likeQuery, normalizedLimit) as Array<{
    imdb_id: string;
    title: string;
  }>;

  return rows.map((row) => ({ label: row.title, value: row.imdb_id || row.title, kind: 'title' }));
};

export const findTagSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number,
  includeInternal = false
): string[] => {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const excludedTags = includeInternal ? [] : [...INTERNAL_TAGS, ...VIRTUAL_TAGS];
  const excludedSql = excludedTags.length ? `AND tag NOT IN (${excludedTags.map(() => '?').join(', ')})` : '';

  const rows = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
       INNER JOIN collection_items ON collection_items.id = collection_item_tags.item_id
       WHERE collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND collection_items.list_type = ?
       AND LOWER(tag) LIKE ? ESCAPE '\\'
       ${excludedSql}
       GROUP BY tag
       ORDER BY count DESC, tag
       LIMIT ?`
    )
    .all(...usernameHashes, 'library', `${escapeLike(lowerQuery)}%`, ...excludedTags, normalizeLimit(limit)) as Array<{
    tag: string;
  }>;

  return rows.map((row) => row.tag);
};

export const findGenreSuggestions = (
  db: Database.Database,
  usernameHashes: string[],
  query: string,
  limit: number
): string[] => {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const rows = db
    .prepare(
      `SELECT genre, COUNT(*) as count
       FROM collection_item_genres
       INNER JOIN collection_items ON collection_items.id = collection_item_genres.item_id
       WHERE collection_items.username_hash IN (${usernameHashes.map(() => '?').join(', ')})
       AND collection_items.list_type = ?
       AND LOWER(genre) LIKE ? ESCAPE '\\'
       GROUP BY genre
       ORDER BY count DESC, genre
       LIMIT ?`
    )
    .all(...usernameHashes, 'library', `${escapeLike(lowerQuery)}%`, normalizeLimit(limit)) as Array<{ genre: string }>;

  return rows.map((row) => row.genre);
};

export const collectionItemExists = (db: Database.Database, usernameHashes: string[], imdbId: string): boolean => {
  return collectionItemExistsInList(db, usernameHashes, imdbId, 'library');
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

export const getCollectionStatistics = (
  db: Database.Database,
  usernameHashes: string[],
  filters?: CollectionItemFiltersApiModel,
  internalCollectionUsernameHash?: string
): CollectionStatisticsApiResponseModel => {
  const queryParts = buildItemWhere(usernameHashes, filters);
  const whereSql = queryParts.where.join(' AND ');
  const matchingItemsSql = `SELECT id FROM collection_items WHERE ${whereSql}`;
  const countTag = (tag: string, exists = true): number =>
    (
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM collection_items
           WHERE ${whereSql}
           AND ${exists ? '' : 'NOT '}EXISTS (
             SELECT 1 FROM collection_item_tags
             WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
           )`
        )
        .get(...queryParts.params, tag) as { count: number }
    ).count;

  const totalItems = (
    db.prepare(`SELECT COUNT(*) as count FROM collection_items WHERE ${whereSql}`).get(...queryParts.params) as {
      count: number;
    }
  ).count;

  const countListType = (listType: CollectionListTypeModel): number =>
    (
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM collection_items
           WHERE username_hash = ?
           AND list_type = ?`
        )
        .get(internalCollectionUsernameHash ?? usernameHashes[0], listType) as { count: number }
    ).count;

  const watchLaterCount = countListType('watch-later');
  const wishlistCount = countListType('wishlist');

  const tagCounts = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM collection_item_tags
       WHERE item_id IN (${matchingItemsSql})
       AND tag NOT IN (${[...INTERNAL_TAGS, ...VIRTUAL_TAGS].map(() => '?').join(', ')})
       GROUP BY tag
       ORDER BY count DESC, tag`
    )
    .all(...queryParts.params, ...INTERNAL_TAGS, ...VIRTUAL_TAGS) as Array<{ tag: string; count: number }>;

  const genreCounts = db
    .prepare(
      `SELECT genre, COUNT(*) as count
       FROM collection_item_genres
       WHERE item_id IN (${matchingItemsSql})
       GROUP BY genre
       ORDER BY count DESC, genre`
    )
    .all(...queryParts.params) as Array<{ genre: string; count: number }>;

  return {
    totalItems,
    movieCount: countTag(MOVIE_TAG),
    seriesCount: countTag(SERIES_TAG),
    favoriteCount: countTag(FAVORITE_TAG),
    watchLaterCount,
    wishlistCount,
    watchedCount: countTag(WATCHED_TAG),
    unwatchedCount: countTag(WATCHED_TAG, false),
    tagCounts,
    genreCounts,
  };
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
       (username_hash, imdb_id, list_type, title, title_lower, year, rate, user_rate, actors, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      item.IMDbId,
      normalizeListType(listType),
      item.title,
      item.title.toLowerCase(),
      item.year ?? '',
      item.rate,
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
  updatedItem: CollectionItemChangeApiModel
): CollectionItemApiModel | undefined => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId, 'library');
  if (!existingItem) return;

  db.prepare(
    `UPDATE collection_items SET
     imdb_id = ?, title = ?, title_lower = ?, year = ?, rate = ?, user_rate = ?, actors = ?, plot = ?, image = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  ).run(
    updatedItem.IMDbId,
    updatedItem.title,
    updatedItem.title.toLowerCase(),
    updatedItem.year ?? '',
    updatedItem.rate,
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

  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, updatedItem.IMDbId, 'library')!);
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

export const updateCollectionItemHash = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  hash: string,
  listType: CollectionListTypeModel = 'library'
): void => {
  db.prepare(
    'UPDATE collection_items SET content_hash = ? WHERE username_hash = ? AND imdb_id = ? AND list_type = ?'
  ).run(hash, usernameHash, imdbId, normalizeListType(listType));
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
