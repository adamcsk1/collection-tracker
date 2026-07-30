import {
  CollectionItemApiModel,
  CollectionListTypeModel,
  CollectionItemsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { resolveCanonicalItemId } from '../external-item-identity-repository';
import { toApiItem } from './collection-mapper';
import { buildItemWhere, normalizeLimit, normalizeListType, normalizeOffset } from './collection-query';
import {
  AiSearchCollectionItem,
  CollectionItemOrderOptions,
  CollectionItemQueryOptions,
  CollectionItemRow,
} from './collection-model';

const stringifySearchValue = (value: unknown): string => `${value ?? ''}`.replace(/\s+/g, ' ').trim();

const buildCollectionOrderBy = ({
  orderBy = 'createdAt',
  orderDirection = 'desc',
}: CollectionItemOrderOptions): string => {
  const directionSql = orderDirection === 'asc' ? 'ASC' : 'DESC';
  if (orderBy === 'alphabet') return `title_lower ${directionSql}, id ${directionSql}`;
  return `created_at ${directionSql}, id ${directionSql}`;
};

const EPISODE_COUNT_IN_CHUNK_SIZE = 400;

const loadSeriesTrackerEpisodeCounts = (
  db: Database.Database,
  itemIds: number[]
): Map<number, { watchedEpisodes: number; totalEpisodes: number }> => {
  const countsByItemId = new Map<number, { watchedEpisodes: number; totalEpisodes: number }>();
  if (!itemIds.length) return countsByItemId;

  for (const itemId of itemIds) {
    countsByItemId.set(itemId, { watchedEpisodes: 0, totalEpisodes: 0 });
  }

  for (let itemIndex = 0; itemIndex < itemIds.length; itemIndex += EPISODE_COUNT_IN_CHUNK_SIZE) {
    const chunk = itemIds.slice(itemIndex, itemIndex + EPISODE_COUNT_IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');

    const totalRows = db
      .prepare(
        `SELECT item_id AS itemId, COALESCE(SUM(episodes), 0) AS total
         FROM series_tracker_seasons
         WHERE item_id IN (${placeholders})
         GROUP BY item_id`
      )
      .all(...chunk) as Array<{ itemId: number; total: number }>;

    for (const row of totalRows) {
      const current = countsByItemId.get(row.itemId) ?? { watchedEpisodes: 0, totalEpisodes: 0 };
      current.totalEpisodes = Number(row.total) || 0;
      countsByItemId.set(row.itemId, current);
    }

    const watchedRows = db
      .prepare(
        `SELECT item_id AS itemId, COUNT(*) AS count
         FROM series_tracker_watched_episodes
         WHERE item_id IN (${placeholders})
         GROUP BY item_id`
      )
      .all(...chunk) as Array<{ itemId: number; count: number }>;

    for (const row of watchedRows) {
      const current = countsByItemId.get(row.itemId) ?? { watchedEpisodes: 0, totalEpisodes: 0 };
      current.watchedEpisodes = Number(row.count) || 0;
      countsByItemId.set(row.itemId, current);
    }
  }

  return countsByItemId;
};

const toAiSearchItem = (
  db: Database.Database,
  row: CollectionItemRow,
  episodeCountsByItemId?: Map<number, { watchedEpisodes: number; totalEpisodes: number }>
): AiSearchCollectionItem => {
  const apiItem = toApiItem(db, row);
  let completed: boolean | null = null;
  let watchStatus: AiSearchCollectionItem['watchStatus'] = 'not-applicable';
  let watchedEpisodes: number | null = null;
  let totalEpisodes: number | null = null;
  let progressPercent: number | null = null;

  if (apiItem.listType === 'series-tracker') {
    completed = apiItem.watchedAt !== null;
    watchStatus = completed ? 'completed' : 'unfinished';
    const episodeCounts = episodeCountsByItemId?.get(row.id) ?? { watchedEpisodes: 0, totalEpisodes: 0 };
    watchedEpisodes = episodeCounts.watchedEpisodes;
    totalEpisodes = episodeCounts.totalEpisodes;
    progressPercent =
      totalEpisodes > 0 ? Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100)) : completed ? 100 : 0;
  } else if (apiItem.listType === 'movie-tracker') {
    completed = true;
    watchStatus = 'watched';
  }

  const fields = [
    apiItem.title,
    apiItem.contentType,
    apiItem.favorite,
    apiItem.listType,
    apiItem.watchedAt,
    completed,
    watchStatus,
    watchedEpisodes,
    totalEpisodes,
    progressPercent,
    apiItem.year,
    apiItem.genre.join(', '),
    apiItem.tags.join(', '),
    apiItem.rate,
    apiItem.rottenTomatoesRate,
    apiItem.metacriticRate,
    apiItem.userRate,
    apiItem.actors,
    apiItem.plot,
  ].map(stringifySearchValue);

  return {
    ...apiItem,
    itemId: row.id,
    completed,
    watchStatus,
    watchedEpisodes,
    totalEpisodes,
    progressPercent,
    aiSearchContentHash: JSON.stringify(fields),
    aiSearchText: fields.filter((value) => value !== '').join('\n'),
  };
};

export const findCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  offset: number,
  limit: number,
  listType: CollectionListTypeModel = 'library',
  viewerUsernameHash = usernameHashes[0]
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

  return rows.map((row) => toApiItem(db, row, viewerUsernameHash));
};

export const searchCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  options: CollectionItemQueryOptions
): CollectionItemsApiResponseModel => {
  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit);
  const viewerUsernameHash = options.viewerUsernameHash ?? usernameHashes[0];
  const queryParts = buildItemWhere(
    usernameHashes,
    options.filters,
    options.matchedIdentities,
    options.matchedCanonicalItemIds,
    viewerUsernameHash
  );
  const whereSql = queryParts.where.join(' AND ');
  const orderBySql = buildCollectionOrderBy({
    orderBy: options.filters?.orderBy,
    orderDirection: options.filters?.orderDirection,
  });

  if (options.matchedIdentities?.length === 0) {
    return { items: [], total: 0, offset, limit };
  }

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM collection_items WHERE ${whereSql}`).get(...queryParts.params) as {
      count: number;
    }
  ).count;

  if (options.matchedIdentities?.length) {
    const rows = db
      .prepare(
        `SELECT *
         FROM collection_items
         WHERE ${whereSql}`
      )
      .all(...queryParts.params) as CollectionItemRow[];
    const rankByCanonicalItemId = new Map(
      (options.matchedCanonicalItemIds ?? []).map((canonicalItemId, index) => [canonicalItemId, index])
    );
    const rankByIdentity = new Map(
      options.matchedIdentities.map((identity, index) => [`${identity.source}\u0000${identity.id}`, index])
    );
    const getRank = (row: CollectionItemRow): number =>
      Math.min(
        row.canonical_item_id
          ? (rankByCanonicalItemId.get(row.canonical_item_id) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY,
        rankByIdentity.get(`${row.external_provider}\u0000${row.external_item_id ?? row.imdb_id ?? ''}`) ??
          Number.POSITIVE_INFINITY,
        row.imdb_id
          ? (rankByIdentity.get(`imdb\u0000${row.imdb_id}`) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY
      );
    const items = rows
      .sort((firstItem, secondItem) => {
        const rankDifference = getRank(firstItem) - getRank(secondItem);
        return Number.isFinite(rankDifference) ? rankDifference : firstItem.id - secondItem.id;
      })
      .slice(offset, offset + limit)
      .map((row) => toApiItem(db, row, viewerUsernameHash));

    return { items, total, offset, limit };
  }

  const rows = db
    .prepare(
      `SELECT *
       FROM collection_items
       WHERE ${whereSql}
       ORDER BY ${orderBySql}
       LIMIT ? OFFSET ?`
    )
    .all(...queryParts.params, limit, offset) as CollectionItemRow[];

  return { items: rows.map((row) => toApiItem(db, row, viewerUsernameHash)), total, offset, limit };
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

export const collectionExternalItemExistsInList = (
  db: Database.Database,
  usernameHashes: string[],
  externalProvider: string,
  externalItemId: string,
  listType: CollectionListTypeModel = 'library'
): boolean => {
  const row = db
    .prepare(
      `SELECT 1 FROM collection_items WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')}) AND external_provider = ? AND external_item_id = ? AND list_type = ? LIMIT 1`
    )
    .get(...usernameHashes, externalProvider, externalItemId, normalizeListType(listType));
  return !!row;
};

export const collectionCanonicalItemExistsInList = (
  db: Database.Database,
  usernameHashes: string[],
  canonicalItemId: string,
  listType: CollectionListTypeModel = 'library'
): boolean => {
  const row = db
    .prepare(
      `SELECT 1 FROM collection_items WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')}) AND canonical_item_id = ? AND list_type = ? LIMIT 1`
    )
    .get(...usernameHashes, canonicalItemId, normalizeListType(listType));
  return !!row;
};

export const collectionCanonicalItemExists = (
  db: Database.Database,
  usernameHashes: string[],
  canonicalItemId: string
): boolean => {
  const row = db
    .prepare(
      `SELECT 1 FROM collection_items WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')}) AND canonical_item_id = ? LIMIT 1`
    )
    .get(...usernameHashes, canonicalItemId);
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
    const apiItem = toApiItem(db, row);
    items.push(apiItem);
    return items;
  }, []);
};

export const findCollectionItemsForAiSearch = (
  db: Database.Database,
  usernameHashes: string[],
  listType: CollectionListTypeModel = 'library'
): AiSearchCollectionItem[] => {
  const rows = db
    .prepare(
      `SELECT *
        FROM collection_items
        WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
        ORDER BY created_at DESC, id DESC`
    )
    .all(...usernameHashes, listType) as CollectionItemRow[];

  const seriesTrackerItemIds =
    listType === 'series-tracker'
      ? rows.map((row) => row.id)
      : rows.filter((row) => row.list_type === 'series-tracker').map((row) => row.id);
  const episodeCountsByItemId = loadSeriesTrackerEpisodeCounts(db, seriesTrackerItemIds);

  return rows.reduce<AiSearchCollectionItem[]>((items, row) => {
    items.push(toAiSearchItem(db, row, episodeCountsByItemId));
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

export const findCollectionItemByExternalId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  listType: CollectionListTypeModel = 'library'
): CollectionItemRow | undefined => {
  return db
    .prepare(
      'SELECT * FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
    )
    .get(usernameHash, externalProvider, externalItemId, normalizeListType(listType)) as CollectionItemRow | undefined;
};

export const findCollectionItemByCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  canonicalItemId: string,
  listType: CollectionListTypeModel = 'library'
): CollectionItemRow | undefined => {
  return db
    .prepare('SELECT * FROM collection_items WHERE username_hash = ? AND canonical_item_id = ? AND list_type = ?')
    .get(usernameHash, canonicalItemId, normalizeListType(listType)) as CollectionItemRow | undefined;
};

export const findCollectionItemByExternalIdOrCanonicalItemId = (
  db: Database.Database,
  usernameHash: string,
  externalProvider: string,
  externalItemId: string,
  listType: CollectionListTypeModel = 'library'
): CollectionItemRow | undefined => {
  const exactItem = findCollectionItemByExternalId(db, usernameHash, externalProvider, externalItemId, listType);
  if (exactItem) return exactItem;

  const canonicalItemId = resolveCanonicalItemId(db, usernameHash, externalProvider, externalItemId);
  return findCollectionItemByCanonicalItemId(db, usernameHash, canonicalItemId, listType);
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
