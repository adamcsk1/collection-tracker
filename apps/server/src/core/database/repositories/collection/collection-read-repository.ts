import {
  CollectionItemApiModel,
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  CollectionItemsApiResponseModel,
} from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { resolveCanonicalItemId } from '../external-item-identity-repository';
import { ExternalIdentityRow } from '../external-item-identity-model';
import { toApiItem } from './collection-mapper';
import {
  buildItemWhere,
  buildReadableItemScope,
  normalizeLimit,
  normalizeListType,
  normalizeOffset,
} from './collection-query';
import {
  AiSearchCollectionItem,
  CollectionItemOrderOptions,
  CollectionItemQueryOptions,
  CollectionItemRow,
  collectionItemProjection,
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

const getIdentityKey = (source: string, id: string): string => `${source}\u0000${id}`;

const getAliasAssociationKey = (usernameHash: string, canonicalItemId: string): string =>
  `${usernameHash}\u0000${canonicalItemId}`;

const loadMatchedAliasRanks = (
  db: Database.Database,
  rows: CollectionItemRow[],
  matchedIdentities: ExternalItemIdentityModel[],
  rankByIdentity: Map<string, number>
): Map<string, number> => {
  const rankByAliasAssociation = new Map<string, number>();
  const ownerUsernameHashes = [...new Set(rows.map((row) => row.username_hash))];
  const readableAssociations = new Set(
    rows.flatMap((row) =>
      row.canonical_item_id ? [getAliasAssociationKey(row.username_hash, row.canonical_item_id)] : []
    )
  );
  const identityIdsBySource = new Map<string, Set<string>>();

  for (const identity of matchedIdentities) {
    const identityIds = identityIdsBySource.get(identity.source) ?? new Set<string>();
    identityIds.add(identity.id);
    identityIdsBySource.set(identity.source, identityIds);
  }

  if (!ownerUsernameHashes.length) return rankByAliasAssociation;

  const ownerUsernameHashesJson = JSON.stringify(ownerUsernameHashes);
  for (const [source, identityIdSet] of identityIdsBySource) {
    const aliasRows = db
      .prepare(
        `SELECT username_hash, canonical_item_id, external_provider, external_item_id, source_confidence
         FROM external_item_identities
         WHERE username_hash IN (SELECT value FROM json_each(?))
           AND external_provider = ?
           AND external_item_id IN (SELECT value FROM json_each(?))`
      )
      .all(ownerUsernameHashesJson, source, JSON.stringify([...identityIdSet])) as ExternalIdentityRow[];

    for (const aliasRow of aliasRows) {
      const associationKey = getAliasAssociationKey(aliasRow.username_hash, aliasRow.canonical_item_id);
      if (!readableAssociations.has(associationKey)) continue;
      const rank = rankByIdentity.get(getIdentityKey(aliasRow.external_provider, aliasRow.external_item_id));
      if (rank === undefined) continue;
      rankByAliasAssociation.set(associationKey, Math.min(rankByAliasAssociation.get(associationKey) ?? rank, rank));
    }
  }

  return rankByAliasAssociation;
};

const loadTrackingEpisodeCounts = (
  db: Database.Database,
  itemIds: number[]
): Map<number, { completedEpisodes: number; totalEpisodes: number }> => {
  const countsByItemId = new Map<number, { completedEpisodes: number; totalEpisodes: number }>();
  if (!itemIds.length) return countsByItemId;

  for (const itemId of itemIds) {
    countsByItemId.set(itemId, { completedEpisodes: 0, totalEpisodes: 0 });
  }

  for (let itemIndex = 0; itemIndex < itemIds.length; itemIndex += EPISODE_COUNT_IN_CHUNK_SIZE) {
    const chunk = itemIds.slice(itemIndex, itemIndex + EPISODE_COUNT_IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');

    const totalRows = db
      .prepare(
        `SELECT item_id AS itemId, COALESCE(SUM(episodes), 0) AS total
         FROM series_tracking_seasons
         WHERE item_id IN (${placeholders})
         GROUP BY item_id`
      )
      .all(...chunk) as Array<{ itemId: number; total: number }>;

    for (const row of totalRows) {
      const current = countsByItemId.get(row.itemId) ?? { completedEpisodes: 0, totalEpisodes: 0 };
      current.totalEpisodes = Number(row.total) || 0;
      countsByItemId.set(row.itemId, current);
    }

    const watchedRows = db
      .prepare(
        `SELECT item_id AS itemId, COUNT(*) AS count
         FROM series_completed_episodes
         WHERE item_id IN (${placeholders})
         GROUP BY item_id`
      )
      .all(...chunk) as Array<{ itemId: number; count: number }>;

    for (const row of watchedRows) {
      const current = countsByItemId.get(row.itemId) ?? { completedEpisodes: 0, totalEpisodes: 0 };
      current.completedEpisodes = Number(row.count) || 0;
      countsByItemId.set(row.itemId, current);
    }
  }

  return countsByItemId;
};

const toAiSearchItem = (
  db: Database.Database,
  row: CollectionItemRow,
  episodeCountsByItemId?: Map<number, { completedEpisodes: number; totalEpisodes: number }>
): AiSearchCollectionItem => {
  const apiItem = toApiItem(db, row);
  let completed: boolean | null = null;
  let watchStatus: AiSearchCollectionItem['watchStatus'] = 'not-applicable';
  let completedEpisodes: number | null = null;
  let totalEpisodes: number | null = null;
  let progressPercent: number | null = null;

  if (apiItem.listType === 'tracking') {
    completed = apiItem.watchedAt !== null;
    if (apiItem.contentType === 'movie') {
      watchStatus = completed ? 'watched' : 'unwatched';
      progressPercent = completed ? 100 : 0;
    } else if (apiItem.contentType === 'book') {
      watchStatus = completed ? 'completed' : 'unfinished';
      const progressCurrent = apiItem.progressCurrent;
      const progressTotal = apiItem.progressTotal;
      progressPercent =
        progressTotal != null && progressTotal > 0 && progressCurrent != null
          ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100))
          : completed
            ? 100
            : 0;
    } else {
      watchStatus = completed ? 'completed' : 'unfinished';
      const episodeCounts = episodeCountsByItemId?.get(row.id) ?? { completedEpisodes: 0, totalEpisodes: 0 };
      completedEpisodes = episodeCounts.completedEpisodes;
      totalEpisodes = episodeCounts.totalEpisodes;
      progressPercent =
        totalEpisodes > 0 ? Math.min(100, Math.round((completedEpisodes / totalEpisodes) * 100)) : completed ? 100 : 0;
    }
  }

  const fields = [
    apiItem.title,
    apiItem.contentType,
    apiItem.favorite,
    apiItem.listType,
    apiItem.watchedAt,
    completed,
    watchStatus,
    completedEpisodes,
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
    completedEpisodes,
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
  listType: CollectionListTypeModel | 'all' = 'library',
  viewerUsernameHash = usernameHashes[0],
  excludeContentTypes?: readonly CollectionItemContentTypeModel[]
): CollectionItemApiModel[] => {
  const whereParts = [`username_hash IN (${usernameHashes.map(() => '?').join(', ')})`];
  const params: unknown[] = [...usernameHashes];
  if (listType !== 'all') {
    whereParts.push('list_type = ?');
    params.push(normalizeListType(listType));
  }
  if (excludeContentTypes?.length) {
    whereParts.push(`content_type NOT IN (${excludeContentTypes.map(() => '?').join(', ')})`);
    params.push(...excludeContentTypes);
  }
  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()}
        FROM collection_items
        WHERE ${whereParts.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params) as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row, viewerUsernameHash));
};

export const searchCollectionItems = (
  db: Database.Database,
  viewerUsernameHash: string,
  options: CollectionItemQueryOptions
): CollectionItemsApiResponseModel => {
  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit);
  const queryParts = buildItemWhere(
    viewerUsernameHash,
    options.filters,
    options.matchedIdentities,
    options.matchedCanonicalItemIds
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
        `SELECT ${collectionItemProjection()}
         FROM collection_items
         WHERE ${whereSql}`
      )
      .all(...queryParts.params) as CollectionItemRow[];
    const rankByCanonicalItemId = new Map(
      (options.matchedCanonicalItemIds ?? []).map((canonicalItemId, index) => [canonicalItemId, index])
    );
    const rankByIdentity = new Map(
      options.matchedIdentities.map((identity, index) => [getIdentityKey(identity.source, identity.id), index])
    );
    const rankByAliasAssociation = loadMatchedAliasRanks(db, rows, options.matchedIdentities, rankByIdentity);
    const getRank = (row: CollectionItemRow): number =>
      Math.min(
        row.canonical_item_id
          ? (rankByCanonicalItemId.get(row.canonical_item_id) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY,
        rankByIdentity.get(getIdentityKey(row.external_provider, row.external_item_id ?? row.imdb_id ?? '')) ??
          Number.POSITIVE_INFINITY,
        row.imdb_id
          ? (rankByIdentity.get(getIdentityKey('imdb', row.imdb_id)) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY,
        row.canonical_item_id
          ? (rankByAliasAssociation.get(getAliasAssociationKey(row.username_hash, row.canonical_item_id)) ??
              Number.POSITIVE_INFINITY)
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
      `SELECT ${collectionItemProjection()}
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
      `SELECT 1
       FROM collection_items
       WHERE username_hash IN (${usernameHashes.map(() => '?').join(', ')})
         AND list_type = ?
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
    .get(...usernameHashes, normalizeListType(listType), imdbId, imdbId);
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
      `SELECT ${collectionItemProjection()}
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
  viewerUsernameHash: string,
  listType: CollectionListTypeModel = 'library'
): AiSearchCollectionItem[] => {
  const scope = buildReadableItemScope(viewerUsernameHash, { listType });
  const rows = db
    .prepare(
      `SELECT ${collectionItemProjection()}
       FROM collection_items
       WHERE ${scope.where.join(' AND ')}
       ORDER BY created_at DESC, id DESC`
    )
    .all(...scope.params) as CollectionItemRow[];

  const watchingItemIds =
    listType === 'tracking'
      ? rows.map((row) => row.id)
      : rows.filter((row) => row.list_type === 'tracking').map((row) => row.id);
  const episodeCountsByItemId = loadTrackingEpisodeCounts(db, watchingItemIds);

  return rows.reduce<AiSearchCollectionItem[]>((items, row) => {
    items.push(toAiSearchItem(db, row, episodeCountsByItemId));
    return items;
  }, []);
};

export const findRandomCollectionItem = (
  db: Database.Database,
  viewerUsernameHash: string
): CollectionItemApiModel | undefined => {
  const scope = buildReadableItemScope(viewerUsernameHash, { listType: 'library' }, false);
  const row = db
    .prepare(
      `SELECT ${collectionItemProjection()} FROM collection_items
        WHERE ${scope.where.join(' AND ')}
        ORDER BY RANDOM() LIMIT 1`
    )
    .get(...scope.params) as CollectionItemRow | undefined;

  return row ? toApiItem(db, row, viewerUsernameHash) : undefined;
};

export const findRandomCollectionImages = (
  db: Database.Database,
  viewerUsernameHash: string,
  count: number
): string[] => {
  const scope = buildReadableItemScope(viewerUsernameHash, { listType: 'library' });
  const rows = db
    .prepare(
      `SELECT image FROM collection_items
       WHERE image != ?
          AND ${scope.where.join(' AND ')}
          ORDER BY RANDOM() LIMIT ?`
    )
    .all('', ...scope.params, count) as Array<{ image: string }>;

  return rows.map((row) => row.image);
};

export const countCollectionItems = (
  db: Database.Database,
  usernameHashes: string[],
  listType: CollectionListTypeModel | 'all' = 'library',
  excludeContentTypes?: readonly CollectionItemContentTypeModel[]
): number => {
  const whereParts = [`username_hash IN (${usernameHashes.map(() => '?').join(', ')})`];
  const params: unknown[] = [...usernameHashes];
  if (listType !== 'all') {
    whereParts.push('list_type = ?');
    params.push(normalizeListType(listType));
  }
  if (excludeContentTypes?.length) {
    whereParts.push(`content_type NOT IN (${excludeContentTypes.map(() => '?').join(', ')})`);
    params.push(...excludeContentTypes);
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM collection_items
       WHERE ${whereParts.join(' AND ')}`
    )
    .get(...params) as { count: number };
  return row.count;
};

export const findCollectionItemByImdbId = (
  db: Database.Database,
  usernameHash: string,
  imdbId: string,
  listType: CollectionListTypeModel = 'library'
): CollectionItemRow | undefined => {
  return db
    .prepare(
      `SELECT ${collectionItemProjection()}
       FROM collection_items
       WHERE username_hash = ?
         AND list_type = ?
         AND (
           (external_provider = 'imdb' AND external_item_id = ?)
           OR EXISTS (
             SELECT 1 FROM external_item_identities imdb_identity
             WHERE imdb_identity.username_hash = collection_items.username_hash
               AND imdb_identity.canonical_item_id = collection_items.canonical_item_id
               AND imdb_identity.external_provider = 'imdb'
               AND imdb_identity.external_item_id = ?
           )
         )`
    )
    .get(usernameHash, normalizeListType(listType), imdbId, imdbId) as CollectionItemRow | undefined;
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
      `SELECT ${collectionItemProjection()}
       FROM collection_items
       WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?`
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
    .prepare(
      `SELECT ${collectionItemProjection()}
       FROM collection_items
       WHERE username_hash = ? AND canonical_item_id = ? AND list_type = ?`
    )
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
      `SELECT ${collectionItemProjection()} FROM collection_items
       WHERE username_hash = ?
       ORDER BY list_type, created_at DESC, id DESC`
    )
    .all(usernameHash) as CollectionItemRow[];

  return rows.map((row) => toApiItem(db, row));
};
