import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { getCollectionStatistics } from '../core/database/repositories/collection-repository';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { parseFilters } from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/statistics`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const usernameHashes = [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)];
      response.send(
        getCollectionStatistics(db, usernameHashes, parseFilters(request.query as Record<string, unknown>))
      );
    })
  );
};
