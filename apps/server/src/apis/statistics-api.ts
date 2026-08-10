import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { getCollectionStatistics } from '../core/database/repositories/collection';
import { jwtGuard } from '../core/jwt';
import { parseFilters } from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/statistics`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const query = request.query as Record<string, unknown>;
      if (query.type !== undefined && query.type !== 'movie' && query.type !== 'series' && query.type !== 'book') {
        return response.code(400).send({ error: 'Invalid media type' });
      }
      const filters = parseFilters(query);
      response.send(getCollectionStatistics(db, request.usernameHash, filters));
    })
  );
};
