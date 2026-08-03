import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemSuggestions } from '../core/database/repositories/collection';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

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
      const listType = parseListType(queryParams.listType) ?? 'library';
      const db = getDatabase();
      const usernameHashes =
        listType === 'library'
          ? [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)]
          : [request.usernameHash];
      response.send({ suggestions: findCollectionItemSuggestions(db, usernameHashes, query, limit, listType) });
    })
  );
};
