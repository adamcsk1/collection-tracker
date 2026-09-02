import { API_PREFIX } from '@shared/constants/api-const';
import {
  MAX_COLLECTION_FILTER_GENRES,
  MAX_COLLECTION_FILTER_TAGS,
} from '@shared/constants/collection-filter-api-const';
import { MAX_COLLECTION_MATCHED_ITEM_IDENTITIES } from '@shared/constants/collection-matched-items-api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { CollectionItemFiltersApiModel, CollectionMatchedItemsApiRequestModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection';
import { resolveCanonicalItemRanksForIdentities } from '../core/database/repositories/external-item-identity-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { CursorValidationError, isCursorToken } from '../core/utils/cursor-util';
import { isCollectionJsonLimit } from '../core/utils/query-parse-util';

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
    (filters.tags === undefined || isStringArray(filters.tags, MAX_COLLECTION_FILTER_TAGS)) &&
    (filters.genres === undefined || isStringArray(filters.genres, MAX_COLLECTION_FILTER_GENRES)) &&
    isOptionalMember(filters.tagMode, ['any', 'all']) &&
    isOptionalMember(filters.type, ['movie', 'series', 'book', 'album']) &&
    (filters.watched === undefined || typeof filters.watched === 'boolean') &&
    (filters.completed === undefined || typeof filters.completed === 'boolean') &&
    (filters.favorite === undefined || typeof filters.favorite === 'boolean') &&
    isOptionalMember(filters.shared, ['mine', 'shared']) &&
    isOptionalMember(filters.listType, ['library', 'up-next', 'wishlist', 'tracking', 'books', 'music'])
  );
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/collection-items/matches`,
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
        !filtersValid ||
        (body.cursor !== undefined && !isCursorToken(body.cursor)) ||
        (body.limit !== undefined && !isCollectionJsonLimit(body.limit))
      ) {
        response.code(400).send();
        return;
      }

      const db = getDatabase();
      const matchedIdentities = body.identities.map((identity) => ({
        source: identity.source,
        id: identity.source === 'imdb' ? identity.id.trim().toLowerCase() : identity.id.trim(),
      }));
      const matchedCanonicalItemRanks = resolveCanonicalItemRanksForIdentities(
        db,
        request.usernameHash,
        matchedIdentities
      );

      try {
        const result = searchCollectionItems(db, request.usernameHash, {
          filters: body.filters,
          cursor: body.cursor,
          limit: body.limit ?? 50,
          matchedIdentities,
          matchedCanonicalItemRanks,
        });
        response.send({ data: result.items, page: result.page });
      } catch (error) {
        if (!(error instanceof CursorValidationError)) throw error;
        response.code(400).send({ error: 'Invalid cursor' });
      }
    })
  );
};
