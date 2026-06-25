import { API_PREFIX } from '@shared/constants/api-const';
import { CollectionMatchedItemsApiRequestModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/matched`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as CollectionMatchedItemsApiRequestModel;
      if (!Array.isArray(body?.imdbIds) || body.imdbIds.some((imdbId) => typeof imdbId !== 'string')) {
        response.code(400).send();
        return;
      }

      const db = getDatabase();
      const usernameHashes =
        body.filters?.listType && body.filters.listType !== 'library'
          ? [request.usernameHash]
          : [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)];

      response.send(
        searchCollectionItems(db, usernameHashes, {
          filters: body.filters,
          offset: parseNumber(body.offset, 0),
          limit: parseNumber(body.limit, 50),
          matchedImdbIds: body.imdbIds,
          viewerUsernameHash: request.usernameHash,
        })
      );
    })
  );
};
