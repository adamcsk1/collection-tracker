import { API_PREFIX } from '@shared/constants/api-const';
import {
  MAX_COLLECTION_MATCHED_FILTER_GENRES,
  MAX_COLLECTION_MATCHED_FILTER_TAGS,
  MAX_COLLECTION_MATCHED_ITEM_IDENTITIES,
} from '@shared/constants/collection-matched-items-api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { CollectionItemFiltersApiModel, CollectionMatchedItemsApiRequestModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection';
import { resolveCanonicalItemIdsForIdentities } from '../core/database/repositories/external-item-identity-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const FILTER_KEYS = [
  'search',
  'tags',
  'genres',
  'tagMode',
  'type',
  'watched',
  'completed',
  'favorite',
  'shared',
  'listType',
  'orderBy',
  'orderDirection',
] as const;

const isStringArray = (value: unknown, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxLength && value.every((item) => typeof item === 'string');

const isOptionalMember = (value: unknown, members: readonly string[]): boolean =>
  value === undefined || (typeof value === 'string' && members.includes(value));

const isCollectionItemFilters = (value: unknown): value is CollectionItemFiltersApiModel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const filters = value as Record<string, unknown>;
  return (
    Object.keys(filters).every((key) => (FILTER_KEYS as readonly string[]).includes(key)) &&
    (filters.search === undefined || typeof filters.search === 'string') &&
    (filters.tags === undefined || isStringArray(filters.tags, MAX_COLLECTION_MATCHED_FILTER_TAGS)) &&
    (filters.genres === undefined || isStringArray(filters.genres, MAX_COLLECTION_MATCHED_FILTER_GENRES)) &&
    isOptionalMember(filters.tagMode, ['any', 'all']) &&
    isOptionalMember(filters.type, ['movie', 'series', 'book']) &&
    (filters.watched === undefined || typeof filters.watched === 'boolean') &&
    (filters.completed === undefined || typeof filters.completed === 'boolean') &&
    (filters.favorite === undefined || typeof filters.favorite === 'boolean') &&
    isOptionalMember(filters.shared, ['mine', 'shared']) &&
    isOptionalMember(filters.listType, ['library', 'up-next', 'wishlist', 'tracking', 'books']) &&
    isOptionalMember(filters.orderBy, ['createdAt', 'alphabet']) &&
    isOptionalMember(filters.orderDirection, ['asc', 'desc'])
  );
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/matched`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as CollectionMatchedItemsApiRequestModel;
      const filtersValid = body?.filters === undefined || isCollectionItemFilters(body.filters);
      if (
        !Array.isArray(body?.identities) ||
        body.identities.length > MAX_COLLECTION_MATCHED_ITEM_IDENTITIES ||
        body.identities.some(
          (identity) =>
            typeof identity?.source !== 'string' ||
            !isExternalItemIdentitySourceName(identity.source) ||
            typeof identity?.id !== 'string' ||
            !identity.id.trim()
        ) ||
        !filtersValid
      ) {
        response.code(400).send();
        return;
      }

      const db = getDatabase();
      const matchedIdentities = body.identities.map((identity) => ({
        source: identity.source,
        id: identity.source === 'imdb' ? identity.id.trim().toLowerCase() : identity.id.trim(),
      }));
      const matchedCanonicalItemIds = resolveCanonicalItemIdsForIdentities(db, request.usernameHash, matchedIdentities);

      response.send(
        searchCollectionItems(db, request.usernameHash, {
          filters: body.filters,
          offset: parseNumber(body.offset, 0),
          limit: parseNumber(body.limit, 50),
          matchedIdentities,
          matchedCanonicalItemIds,
        })
      );
    })
  );
};
