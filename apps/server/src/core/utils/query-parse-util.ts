import {
  CollectionItemFiltersApiModel,
  CollectionItemTagMode,
  CollectionItemTypeFilter,
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
  if (value === 'movie' || value === 'series') return value;
  return;
};

export const parseTagMode = (value: unknown): CollectionItemTagMode | undefined => {
  if (value === 'any' || value === 'all') return value;
  return;
};

export const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseFilters = (query: Record<string, unknown>): CollectionItemFiltersApiModel => ({
  search: typeof query.search === 'string' ? query.search : undefined,
  tags: parseList(query.tags),
  genres: parseList(query.genres),
  tagMode: parseTagMode(query.tagMode),
  type: parseType(query.type),
  watched: parseBoolean(query.watched),
});
