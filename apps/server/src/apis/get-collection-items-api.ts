import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection';
import { jwtGuard } from '../core/jwt';
import {
  areCollectionFilterListsWithinLimits,
  isCollectionItemsQueryValid,
  parseCollectionQueryLimit,
  parseFilters,
} from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { CursorValidationError } from '../core/utils/cursor-util';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      if (!isCollectionItemsQueryValid(query)) {
        response.code(400).send();
        return;
      }
      const filters = parseFilters(query);
      if (!areCollectionFilterListsWithinLimits(filters)) {
        response.code(400).send();
        return;
      }
      const db = getDatabase();
      try {
        const result = searchCollectionItems(db, request.usernameHash, {
          filters,
          cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
          limit: parseCollectionQueryLimit(query.limit),
        });
        response.send({ data: result.items, page: result.page });
      } catch (error) {
        if (!(error instanceof CursorValidationError)) throw error;
        response.code(400).send({ error: 'Invalid cursor' });
      }
    })
  );
};
