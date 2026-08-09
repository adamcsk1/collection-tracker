import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findTagSuggestions } from '../core/database/repositories/collection';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 10;
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/tag-suggestions`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const queryParams = request.query as Record<string, unknown>;
      const query = typeof queryParams.query === 'string' ? queryParams.query : '';
      const db = getDatabase();
      response.send({
        tags: findTagSuggestions(db, request.usernameHash, query, parseLimit(queryParams.limit)),
      });
    })
  );
};
