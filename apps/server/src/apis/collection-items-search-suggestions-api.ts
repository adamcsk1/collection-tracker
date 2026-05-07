import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemSuggestions } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/items/search-suggestions`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const queryParams = request.query as Record<string, unknown>;
      const query = typeof queryParams.query === 'string' ? queryParams.query : '';
      const limit = parseNumber(queryParams.limit, 10);
      response.send({ suggestions: findCollectionItemSuggestions(getDatabase(), request.usernameHash, query, limit) });
    })
  );
};
