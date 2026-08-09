import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import {
  CollectionItemFiltersApiModel,
  CollectionItemTagMode,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { QueryParts } from './collection-model';

export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export const normalizeLimit = (limit: number): number => Math.min(Math.max(Math.floor(limit) || 10, 1), 100);

export const normalizeOffset = (offset: number): number => Math.max(Math.floor(offset) || 0, 0);

export const normalizeListType = (listType: CollectionListTypeModel | undefined): CollectionListTypeModel => {
  if (listType === 'up-next' || listType === 'wishlist' || listType === 'tracking' || listType === 'books')
    return listType;
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

const addMovieWatchedExists = (queryParts: QueryParts, usernameHash: string, exists = true): void => {
  queryParts.where.push(`${exists ? '' : 'NOT '}EXISTS (
    SELECT 1 FROM collection_items movie_watched_filter
    LEFT JOIN collection_item_tracker_state movie_tracker_state ON movie_tracker_state.item_id = movie_watched_filter.id
    WHERE movie_watched_filter.username_hash = ?
      AND ${canonicalOrExactIdentityMatch('movie_watched_filter')}
      AND movie_watched_filter.list_type = 'tracking'
      AND movie_watched_filter.content_type = 'movie'
      AND movie_tracker_state.completed_at IS NOT NULL
  )`);
  queryParts.params.push(usernameHash);
};

const addTrackingExists = (queryParts: QueryParts, usernameHash: string, exists = true): void => {
  queryParts.where.push(`${exists ? '' : 'NOT '}EXISTS (
    SELECT 1 FROM collection_items series_watching_filter
    WHERE series_watching_filter.username_hash = ?
      AND ${canonicalOrExactIdentityMatch('series_watching_filter')}
      AND series_watching_filter.list_type = ?
  )`);
  queryParts.params.push(usernameHash, 'tracking');
};

const addWatchedExists = (queryParts: QueryParts, usernameHash: string, exists = true): void => {
  queryParts.where.push(`(
    (${movieContentCondition} AND ${exists ? '' : 'NOT '}EXISTS (
      SELECT 1 FROM collection_items movie_watched_filter
      LEFT JOIN collection_item_tracker_state movie_tracker_state ON movie_tracker_state.item_id = movie_watched_filter.id
      WHERE movie_watched_filter.username_hash = ?
        AND ${canonicalOrExactIdentityMatch('movie_watched_filter')}
        AND movie_watched_filter.list_type = 'tracking'
        AND movie_watched_filter.content_type = 'movie'
        AND movie_tracker_state.completed_at IS NOT NULL
    ))
    OR (${seriesContentCondition} AND ${exists ? '' : 'NOT '}EXISTS (
      SELECT 1 FROM collection_items series_watching_filter
      WHERE series_watching_filter.username_hash = ?
        AND ${canonicalOrExactIdentityMatch('series_watching_filter')}
        AND series_watching_filter.list_type = 'tracking'
    ))
    OR (${bookContentCondition} AND ${exists ? '' : 'NOT '}EXISTS (
      SELECT 1 FROM collection_items book_finished_filter
      LEFT JOIN collection_item_tracker_state book_tracker_state ON book_tracker_state.item_id = book_finished_filter.id
      WHERE book_finished_filter.username_hash = ?
        AND ${canonicalOrExactIdentityMatch('book_finished_filter')}
        AND book_finished_filter.list_type = 'tracking'
        AND book_finished_filter.content_type = 'book'
        AND book_tracker_state.completed_at IS NOT NULL
    ))
  )`);
  queryParts.params.push(usernameHash, usernameHash, usernameHash);
};

export const canonicalOrExactIdentityMatch = (alias: string): string => `(
  (${alias}.canonical_item_id IS NOT NULL AND ${alias}.canonical_item_id = collection_items.canonical_item_id)
  OR (
    COALESCE(${alias}.external_provider, '${DEFAULT_EXTERNAL_METADATA_PROVIDER}') = COALESCE(collection_items.external_provider, '${DEFAULT_EXTERNAL_METADATA_PROVIDER}')
    AND ${alias}.external_item_id = collection_items.external_item_id
  )
)`;

const pushJsonArrayInCondition = (
  conditions: string[],
  queryParts: QueryParts,
  columnExpression: string,
  values: string[]
): void => {
  if (!values.length) return;
  conditions.push(`${columnExpression} IN (SELECT value FROM json_each(?))`);
  queryParts.params.push(JSON.stringify(values));
};

const addMatchedIdentityFilter = (
  queryParts: QueryParts,
  matchedIdentities: ExternalItemIdentityModel[] | undefined,
  matchedCanonicalItemIds: string[] | undefined
): void => {
  const conditions: string[] = [];
  const uniqueCanonicalItemIds = [...new Set(matchedCanonicalItemIds ?? [])];
  pushJsonArrayInCondition(conditions, queryParts, 'collection_items.canonical_item_id', uniqueCanonicalItemIds);

  const identitiesBySource = new Map<string, string[]>();
  for (const identity of matchedIdentities ?? []) {
    const sourceIds = identitiesBySource.get(identity.source) ?? [];
    sourceIds.push(identity.id);
    identitiesBySource.set(identity.source, sourceIds);
  }

  for (const [source, sourceIds] of identitiesBySource) {
    const uniqueSourceIds = [...new Set(sourceIds)];
    const sourceIdsJson = JSON.stringify(uniqueSourceIds);
    conditions.push(`(
      (collection_items.external_provider = ?
        AND collection_items.external_item_id IN (SELECT value FROM json_each(?)))
      OR EXISTS (
        SELECT 1 FROM external_item_identities matched_identity
        WHERE matched_identity.username_hash = collection_items.username_hash
          AND matched_identity.canonical_item_id = collection_items.canonical_item_id
          AND matched_identity.external_provider = ?
          AND matched_identity.external_item_id IN (SELECT value FROM json_each(?))
      )
    )`);
    queryParts.params.push(source, sourceIdsJson, source, sourceIdsJson);
  }

  if (conditions.length) queryParts.where.push(`(${conditions.join(' OR ')})`);
};

const addSearchFilter = (queryParts: QueryParts, search: string): void => {
  const lowerSearch = search.trim().toLowerCase();
  if (!lowerSearch) return;

  const likeSearch = `%${escapeLike(lowerSearch)}%`;
  queryParts.where.push(`(
    collection_items.title_lower LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.external_item_id) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.year) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.contributors) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.description) LIKE ? ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM external_item_identities search_identities
      WHERE search_identities.username_hash = collection_items.username_hash
        AND search_identities.canonical_item_id = collection_items.canonical_item_id
        AND LOWER(search_identities.external_item_id) LIKE ? ESCAPE '\\'
    )
    OR EXISTS (
      SELECT 1 FROM collection_item_external_ratings search_ratings
      WHERE search_ratings.item_id = collection_items.id
        AND LOWER(search_ratings.value) LIKE ? ESCAPE '\\'
    )
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
    likeSearch,
    likeSearch
  );
};

const movieContentCondition = `collection_items.content_type = 'movie'`;

const seriesContentCondition = `collection_items.content_type = 'series'`;

const bookContentCondition = `collection_items.content_type = 'book'`;

export const buildReadableItemScope = (
  viewerUsernameHash: string,
  filters: CollectionItemFiltersApiModel | undefined,
  foldBooksIntoLibrary = true
): QueryParts => {
  const listType = normalizeListType(filters?.listType);
  const sharedFilter = filters?.shared;
  const includeMine = sharedFilter !== 'shared';
  const includeShared = sharedFilter !== 'mine';
  const typeFilter =
    filters?.type === 'movie' || filters?.type === 'series' || filters?.type === 'book' ? filters.type : undefined;

  const itemClauses: string[] = [];
  const params: Array<string | number> = [];

  if (listType === 'library' && foldBooksIntoLibrary) {
    if (typeFilter === 'book') {
      itemClauses.push(`collection_items.list_type = 'books' AND collection_items.content_type = 'book'`);
    } else if (typeFilter === 'movie' || typeFilter === 'series') {
      itemClauses.push(`collection_items.list_type = 'library' AND collection_items.content_type = ?`);
      params.push(typeFilter);
    } else {
      itemClauses.push(`(
        collection_items.list_type = 'library'
        OR (collection_items.list_type = 'books' AND collection_items.content_type = 'book')
      )`);
    }
  } else {
    itemClauses.push('collection_items.list_type = ?');
    params.push(listType);
    if (typeFilter) {
      itemClauses.push('collection_items.content_type = ?');
      params.push(typeFilter);
    }
  }

  const readableGrantExists = `EXISTS (
    SELECT 1 FROM user_share_grants readable_grant
    WHERE readable_grant.shared_with_username_hash = ?
      AND readable_grant.owner_username_hash = collection_items.username_hash
      AND readable_grant.list_type = collection_items.list_type
      AND readable_grant.content_type = collection_items.content_type
      AND readable_grant.can_read = 1
  )`;
  if (includeMine && includeShared) {
    itemClauses.push(`(collection_items.username_hash = ? OR ${readableGrantExists})`);
    params.push(viewerUsernameHash, viewerUsernameHash);
  } else if (includeMine) {
    itemClauses.push('collection_items.username_hash = ?');
    params.push(viewerUsernameHash);
  } else {
    itemClauses.push(readableGrantExists);
    params.push(viewerUsernameHash);
  }

  return {
    where: itemClauses,
    params,
  };
};

const addFilters = (
  queryParts: QueryParts,
  filters: CollectionItemFiltersApiModel | undefined,
  viewerUsernameHash?: string
): void => {
  if (!filters) return;

  const listType = normalizeListType(filters.listType);
  const tags = (filters.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

  addSearchFilter(queryParts, filters.search ?? '');

  if (filters.watched !== undefined && viewerUsernameHash && listType !== 'tracking') {
    const exists = filters.watched;
    if (filters.type === 'series') addTrackingExists(queryParts, viewerUsernameHash, exists);
    else if (filters.type === 'movie') addMovieWatchedExists(queryParts, viewerUsernameHash, exists);
    else addWatchedExists(queryParts, viewerUsernameHash, exists);
  }
  if (filters.completed === true)
    queryParts.where.push(
      'EXISTS (SELECT 1 FROM collection_item_tracker_state WHERE item_id = collection_items.id AND completed_at IS NOT NULL)'
    );
  if (filters.completed === false)
    queryParts.where.push(
      'NOT EXISTS (SELECT 1 FROM collection_item_tracker_state WHERE item_id = collection_items.id AND completed_at IS NOT NULL)'
    );
  if (filters.favorite === true) queryParts.where.push('collection_items.favorite = 1');
  if (filters.favorite === false) queryParts.where.push('collection_items.favorite = 0');

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

export const buildItemWhere = (
  viewerUsernameHash: string,
  filters: CollectionItemFiltersApiModel | undefined,
  matchedIdentities?: ExternalItemIdentityModel[],
  matchedCanonicalItemIds?: string[]
): QueryParts => {
  const ownership = buildReadableItemScope(viewerUsernameHash, filters);
  const queryParts: QueryParts = {
    where: [...ownership.where],
    params: [...ownership.params],
  };
  addFilters(queryParts, filters, viewerUsernameHash);
  addMatchedIdentityFilter(queryParts, matchedIdentities, matchedCanonicalItemIds);

  return queryParts;
};
