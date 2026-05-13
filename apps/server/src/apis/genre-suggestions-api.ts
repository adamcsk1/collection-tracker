import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findGenreSuggestions } from '../core/database/repositories/collection-repository';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 10;
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/genres/suggestions`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const queryParams = request.query as Record<string, unknown>;
      const query = typeof queryParams.query === 'string' ? queryParams.query : '';
      const db = getDatabase();
      const usernameHashes = [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)];

      response.send({
        genres: findGenreSuggestions(db, usernameHashes, query, parseLimit(queryParams.limit)),
      });
    })
  );
};
