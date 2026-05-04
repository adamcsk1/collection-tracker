import Database from 'better-sqlite3';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS, WATCHED_TAG } from '@shared/constants/tags-const';
import {
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionItemFiltersApiModel,
  CollectionItemSuggestionApiModel,
  CollectionItemsApiResponseModel,
  CollectionStatisticsApiResponseModel,
  CollectionItemTagMode,
} from '@shared/models/api-model';
import { getItemHash } from '../../utils/collection-item-util';

export interface CollectionItemRow {
  id: number;
  username_hash: string;
  imdb_id: string;
  title: string;
  title_lower: string;
  year: string;
  rate: string;
  actors: string;
  plot: string;
  image: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionItemPromptModel {
  imdbId: string;
  content: string;
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

const INTERNAL_TAGS = [WATCHED_TAG, MOVIE_TAG, SERIES_TAG];
const SUGGESTION_SYSTEM_TAGS = [...VIRTUAL_TAGS, WATCHED_TAG, MOVIE_TAG, SERIES_TAG];

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

const normalizeLimit = (limit: number): number => Math.min(Math.max(Math.floor(limit) || 10, 1), 100);

const normalizeOffset = (offset: number): number => Math.max(Math.floor(offset) || 0, 0);

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
  if (!filters) return;

  addSearchFilter(queryParts, filters.search ?? '');

  if (filters.type === 'movie') addTagExists(queryParts, MOVIE_TAG);
  if (filters.type === 'series') addTagExists(queryParts, SERIES_TAG);
  if (filters.watched === true) addTagExists(queryParts, WATCHED_TAG);
  if (filters.watched === false) addTagExists(queryParts, WATCHED_TAG, false);

  for (const genre of filters.genres ?? []) {
    const normalizedGenre = genre.trim();
    if (normalizedGenre) addGenreExists(queryParts, normalizedGenre);
  }

  const tags = (filters.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
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
  usernameHash: string,
  filters: CollectionItemFiltersApiModel | undefined,
  matchedImdbIds?: string[]
): QueryParts => {
  const queryParts: QueryParts = { where: ['collection_items.username_hash = ?'], params: [usernameHash] };
  addFilters(queryParts, filters);

  if (matchedImdbIds?.length) {
    queryParts.where.push(`collection_items.imdb_id IN (${matchedImdbIds.map(() => '?').join(', ')})`);
    queryParts.params.push(...matchedImdbIds);
  }

  return queryParts;
};

const buildSearchableTextLower = (item: CollectionItemChangeApiModel): string =>
  [
    item.title,
    item.genre.join(' '),
    item.IMDbId,
    item.tags.join(' '),
    item.year ?? '',
    item.rate,
    item.actors,
    item.plot,
  ]
    .join(' ')
    .toLowerCase();

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
    actors: row.actors,
    plot: row.plot,
  };

  return {
    ...item,
    titleLower: row.title_lower,
    searchableTextLower: buildSearchableTextLower(item),
    hash: row.content_hash,
  };
};

export const findCollectionItems = (
  db: Database.Database,
  usernameHash: string,
  offset: number,
  limit: number
): CollectionItemApiModel[] => {
  const rows = db
    .prepare(
      `SELECT *
       FROM collection_items
       WHERE username_hash = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(usernameHash, limit, offset) as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row));
};

export const searchCollectionItems = (
  db: Database.Database,
  usernameHash: string,
  options: CollectionItemQueryOptions
): CollectionItemsApiResponseModel => {
  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit);
  const queryParts = buildItemWhere(usernameHash, options.filters, options.matchedImdbIds);
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
  usernameHash: string,
  query: string,
  limit: number
): CollectionItemSuggestionApiModel[] => {
  const normalizedLimit = normalizeLimit(limit);
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  if (lowerQuery.startsWith('#')) {
    const systemTagSuggestions = SUGGESTION_SYSTEM_TAGS.filter((tag) => tag.startsWith(lowerQuery));
    const remainingLimit = normalizedLimit - systemTagSuggestions.length;
    const customTagSuggestions = remainingLimit > 0 ? findTagSuggestions(db, usernameHash, query, remainingLimit) : [];

    return [...systemTagSuggestions, ...customTagSuggestions]
      .slice(0, normalizedLimit)
      .map((tag) => ({ label: tag, value: tag, kind: 'tag' }));
  }

  const likeQuery = `%${escapeLike(lowerQuery)}%`;
  const rows = db
    .prepare(
      `SELECT imdb_id, title
       FROM collection_items
       WHERE username_hash = ?
       AND (
         title_lower LIKE ? ESCAPE '\\'
         OR LOWER(imdb_id) LIKE ? ESCAPE '\\'
         OR LOWER(actors) LIKE ? ESCAPE '\\'
         OR LOWER(plot) LIKE ? ESCAPE '\\'
       )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(usernameHash, likeQuery, likeQuery, likeQuery, likeQuery, normalizedLimit) as Array<{
    imdb_id: string;
    title: string;
  }>;

  return rows.map((row) => ({ label: row.title, value: row.imdb_id || row.title, kind: 'title' }));
};

export const findTagSuggestions = (
  db: Database.Database,
  usernameHash: string,
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
       WHERE collection_items.username_hash = ?
       AND LOWER(tag) LIKE ? ESCAPE '\\'
       ${excludedSql}
       GROUP BY tag
       ORDER BY count DESC, tag
       LIMIT ?`
    )
    .all(usernameHash, `${escapeLike(lowerQuery)}%`, ...excludedTags, normalizeLimit(limit)) as Array<{ tag: string }>;

  return rows.map((row) => row.tag);
};

export const findGenreSuggestions = (
  db: Database.Database,
  usernameHash: string,
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
       WHERE collection_items.username_hash = ?
       AND LOWER(genre) LIKE ? ESCAPE '\\'
       GROUP BY genre
       ORDER BY count DESC, genre
       LIMIT ?`
    )
    .all(usernameHash, `${escapeLike(lowerQuery)}%`, normalizeLimit(limit)) as Array<{ genre: string }>;

  return rows.map((row) => row.genre);
};

export const collectionItemExists = (db: Database.Database, usernameHash: string, imdbId: string): boolean => {
  return !!findCollectionItemByImdbId(db, usernameHash, imdbId);
};

export const getCollectionStatistics = (
  db: Database.Database,
  usernameHash: string,
  filters?: CollectionItemFiltersApiModel
): CollectionStatisticsApiResponseModel => {
  const queryParts = buildItemWhere(usernameHash, filters);
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
    watchedCount: countTag(WATCHED_TAG),
    unwatchedCount: countTag(WATCHED_TAG, false),
    tagCounts,
    genreCounts,
  };
};

export const findCollectionItemsForPrompt = (
  db: Database.Database,
  usernameHash: string
): CollectionItemPromptModel[] => {
  const rows = db
    .prepare(
      `SELECT *
       FROM collection_items
       WHERE username_hash = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(usernameHash) as CollectionItemRow[];

  return rows.reduce<CollectionItemPromptModel[]>((items, row) => {
    if (!row.imdb_id) return items;

    const apiItem = toApiItem(db, row);
    items.push({
      imdbId: apiItem.IMDbId,
      content: JSON.stringify({
        IMDbId: apiItem.IMDbId,
        title: apiItem.title,
        year: apiItem.year,
        rate: apiItem.rate,
        genre: apiItem.genre,
        tags: apiItem.tags,
        actors: apiItem.actors,
        plot: apiItem.plot,
        image: apiItem.image,
      }),
    });

    return items;
  }, []);
};

export const findRandomCollectionItem = (
  db: Database.Database,
  usernameHash: string
): CollectionItemApiModel | undefined => {
  const row = db
    .prepare('SELECT * FROM collection_items WHERE username_hash = ? ORDER BY RANDOM() LIMIT 1')
    .get(usernameHash) as CollectionItemRow | undefined;

  return row ? toApiItem(db, row) : undefined;
};

export const findRandomCollectionImages = (db: Database.Database, usernameHash: string, count: number): string[] => {
  const rows = db
    .prepare('SELECT image FROM collection_items WHERE username_hash = ? AND image != ? ORDER BY RANDOM() LIMIT ?')
    .all(usernameHash, '', count) as Array<{ image: string }>;

  return rows.map((row) => row.image);
};

export const countCollectionItems = (db: Database.Database, usernameHash: string): number => {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ?')
    .get(usernameHash) as { count: number };
  return row.count;
};

export const findCollectionItemByImdbId = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string
): CollectionItemRow | undefined => {
  return db
    .prepare('SELECT * FROM collection_items WHERE username_hash = ? AND imdb_id = ?')
    .get(usernameHash, imdbId) as CollectionItemRow | undefined;
};

export const insertCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  hash: string,
  item: CollectionItemChangeApiModel
): CollectionItemApiModel => {
  const result = db
    .prepare(
      `INSERT INTO collection_items
       (username_hash, imdb_id, title, title_lower, year, rate, actors, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      item.IMDbId,
      item.title,
      item.title.toLowerCase(),
      item.year ?? '',
      item.rate,
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

  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, item.IMDbId)!);
};

export const updateCollectionItem = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  hash: string,
  updatedItem: CollectionItemChangeApiModel
): CollectionItemApiModel | undefined => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId);
  if (!existingItem) return;

  db.prepare(
    `UPDATE collection_items SET
     imdb_id = ?, title = ?, title_lower = ?, year = ?, rate = ?, actors = ?, plot = ?, image = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    updatedItem.IMDbId,
    updatedItem.title,
    updatedItem.title.toLowerCase(),
    updatedItem.year ?? '',
    updatedItem.rate,
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

  return toApiItem(db, findCollectionItemByImdbId(db, usernameHash, updatedItem.IMDbId)!);
};

export const deleteCollectionItem = (db: Database.Database, usernameHash: string, imdbId: string): void => {
  const existingItem = findCollectionItemByImdbId(db, usernameHash, imdbId);
  if (!existingItem) return;

  db.prepare('DELETE FROM collection_item_genres WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_item_tags WHERE item_id = ?').run(existingItem.id);
  db.prepare('DELETE FROM collection_items WHERE id = ?').run(existingItem.id);
};

export const updateCollectionItemHash = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  hash: string
): void => {
  db.prepare('UPDATE collection_items SET content_hash = ? WHERE username_hash = ? AND imdb_id = ?').run(
    hash,
    usernameHash,
    imdbId
  );
};

export const markAllAsWatched = (db: Database.Database, usernameHash: string): number => {
  const rows = db
    .prepare(
      `SELECT * FROM collection_items
       WHERE username_hash = ?
       AND NOT EXISTS (
         SELECT 1 FROM collection_item_tags
         WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
       )`
    )
    .all(usernameHash, WATCHED_TAG) as CollectionItemRow[];

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
       AND EXISTS (
         SELECT 1 FROM collection_item_tags
         WHERE collection_item_tags.item_id = collection_items.id AND collection_item_tags.tag = ?
       )`
    )
    .all(usernameHash, WATCHED_TAG) as CollectionItemRow[];

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
