import { parseCollectionListType } from '@shared/utils/collection-list-type-util';
import {
  CollectionItemFiltersApiModel,
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionItemSharedFilter,
  CollectionItemTagMode,
  CollectionItemTypeFilter,
  CollectionListTypeModel,
} from '@shared/models/api-model';

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
  if (value === 'movie' || value === 'series' || value === 'book') return value;
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
