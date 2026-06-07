import { MOVIE_TAG, SERIES_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import {
  CollectionItemFiltersApiModel,
  CollectionItemTagMode,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { QueryParts } from './collection-types';

export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export const normalizeLimit = (limit: number): number => Math.min(Math.max(Math.floor(limit) || 10, 1), 100);

export const normalizeOffset = (offset: number): number => Math.max(Math.floor(offset) || 0, 0);

export const normalizeListType = (listType: CollectionListTypeModel | undefined): CollectionListTypeModel => {
  if (listType === 'watch-later' || listType === 'wishlist' || listType === 'series-tracker') return listType;
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
    OR LOWER(collection_items.rotten_tomatoes_rate) LIKE ? ESCAPE '\\'
    OR LOWER(collection_items.metacritic_rate) LIKE ? ESCAPE '\\'
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

export const buildItemWhere = (
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
