import { API_PREFIX } from '@shared/constants/api-const';
import { WATCH_LATER_TAG, WISHLIST_TAG } from '@shared/constants/tags-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection-repository';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { parseFilters, parseNumber } from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/items`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const filters = parseFilters(request.query as Record<string, unknown>);
      const isInternalCollectionRequest = (filters.tags ?? []).some((tag) =>
        [WATCH_LATER_TAG, WISHLIST_TAG].includes(tag.toLowerCase())
      );
      const usernameHashes = isInternalCollectionRequest
        ? [request.usernameHash]
        : [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)];
      response.send(
        searchCollectionItems(db, usernameHashes, {
          filters,
          offset: parseNumber((request.query as Record<string, unknown>).offset, 0),
          limit: parseNumber((request.query as Record<string, unknown>).limit, 50),
        })
      );
    })
  );
};
