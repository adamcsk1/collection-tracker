import { API_PREFIX } from '@shared/constants/api-const';
import {
  CollectionItemFiltersApiModel,
  CollectionItemTagMode,
  CollectionItemTypeFilter,
} from '@shared/models/api-model';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { getCollectionStatistics } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) return value.flatMap((entry) => parseList(entry) ?? []);
  if (typeof value !== 'string') return;
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return;
};

const parseType = (value: unknown): CollectionItemTypeFilter | undefined => {
  if (value === 'movie' || value === 'series') return value;
  return;
};

const parseTagMode = (value: unknown): CollectionItemTagMode | undefined => {
  if (value === 'any' || value === 'all') return value;
  return;
};

const parseFilters = (query: Record<string, unknown>): CollectionItemFiltersApiModel => ({
  search: typeof query.search === 'string' ? query.search : undefined,
  tags: parseList(query.tags),
  genres: parseList(query.genres),
  tagMode: parseTagMode(query.tagMode),
  type: parseType(query.type),
  watched: parseBoolean(query.watched),
});

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/statistics`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      response.send(getCollectionStatistics(getDatabase(), request.usernameHash, parseFilters(request.query)));
    })
  );
};
