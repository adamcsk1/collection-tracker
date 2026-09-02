import { parseCollectionListType } from '@shared/utils/collection-list-type-util';
import {
  MAX_COLLECTION_FILTER_GENRES,
  MAX_COLLECTION_FILTER_TAGS,
} from '@shared/constants/collection-filter-api-const';
import {
  CollectionItemFiltersApiModel,
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionItemSharedFilter,
  CollectionItemTagMode,
  CollectionItemTypeFilter,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { isCursorToken } from './cursor-util';

const COLLECTION_PAGE_DEFAULT_LIMIT = 50;
const COLLECTION_PAGE_MAX_LIMIT = 100;

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';

const isOptionalStringList = (value: unknown): boolean =>
  value === undefined ||
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));

const isOptionalMember = (value: unknown, members: readonly string[]): boolean =>
  value === undefined || (typeof value === 'string' && members.includes(value));

const isOptionalQueryBoolean = (value: unknown): boolean =>
  value === undefined || value === 'true' || value === 'false';

export const isCanonicalCollectionQueryLimit = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) <= COLLECTION_PAGE_MAX_LIMIT;

export const isCollectionJsonLimit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= COLLECTION_PAGE_MAX_LIMIT;

export const parseCollectionQueryLimit = (value: string | undefined): number =>
  value === undefined ? COLLECTION_PAGE_DEFAULT_LIMIT : Number(value);

export const isCollectionItemsQueryValid = (
  query: Record<string, unknown>
): query is Record<string, unknown> & { cursor?: string; limit?: string } =>
  isOptionalString(query.search) &&
  isOptionalStringList(query.tags) &&
  isOptionalStringList(query.genres) &&
  isOptionalMember(query.tagMode, ['any', 'all']) &&
  isOptionalMember(query.type, ['movie', 'series', 'book', 'album']) &&
  isOptionalQueryBoolean(query.favorite) &&
  isOptionalQueryBoolean(query.watched) &&
  isOptionalQueryBoolean(query.completed) &&
  isOptionalMember(query.shared, ['mine', 'shared']) &&
  isOptionalMember(query.listType, ['library', 'up-next', 'wishlist', 'tracking', 'books', 'music']) &&
  isOptionalMember(query.orderBy, ['createdAt', 'alphabet']) &&
  isOptionalMember(query.orderDirection, ['asc', 'desc']) &&
  (query.cursor === undefined || isCursorToken(query.cursor)) &&
  (query.limit === undefined || isCanonicalCollectionQueryLimit(query.limit));

export const parseList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) return value.flatMap((entry) => parseList(entry) ?? []);
  if (typeof value !== 'string') return;
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
};

export const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return;
};

export const parseType = (value: unknown): CollectionItemTypeFilter | undefined => {
  if (value === 'movie' || value === 'series' || value === 'book' || value === 'album') return value;
  return;
};

export const parseTagMode = (value: unknown): CollectionItemTagMode | undefined => {
  if (value === 'any' || value === 'all') return value;
  return;
};

export const parseListType = (value: unknown): CollectionListTypeModel | undefined => parseCollectionListType(value);

export const parseOrderBy = (value: unknown): CollectionItemOrderBy | undefined => {
  if (value === 'createdAt' || value === 'alphabet') return value;
  return;
};

export const parseOrderDirection = (value: unknown): CollectionItemOrderDirection | undefined => {
  if (value === 'asc' || value === 'desc') return value;
  return;
};

export const parseSharedFilter = (value: unknown): CollectionItemSharedFilter | undefined => {
  if (value === 'mine' || value === 'shared') return value;
  return;
};

export const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseFilters = (query: Record<string, unknown>): CollectionItemFiltersApiModel => {
  const tags = parseList(query.tags);
  const listType = parseListType(query.listType);

  return {
    search: typeof query.search === 'string' ? query.search : undefined,
    tags,
    genres: parseList(query.genres),
    tagMode: parseTagMode(query.tagMode),
    type: parseType(query.type),
    favorite: parseBoolean(query.favorite),
    watched: parseBoolean(query.watched),
    completed: parseBoolean(query.completed),
    shared: parseSharedFilter(query.shared),
    listType,
    orderBy: parseOrderBy(query.orderBy),
    orderDirection: parseOrderDirection(query.orderDirection),
  };
};

export const areCollectionFilterListsWithinLimits = (filters: CollectionItemFiltersApiModel): boolean =>
  (filters.tags?.length ?? 0) <= MAX_COLLECTION_FILTER_TAGS &&
  (filters.genres?.length ?? 0) <= MAX_COLLECTION_FILTER_GENRES;
