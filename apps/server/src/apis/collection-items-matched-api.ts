import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { CollectionMatchedItemsApiRequestModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection';
import { resolveCanonicalItemIdsForIdentities } from '../core/database/repositories/external-item-identity-repository';
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
      if (
        !Array.isArray(body?.identities) ||
        body.identities.some(
          (identity) =>
            typeof identity?.source !== 'string' ||
            !isExternalItemIdentitySourceName(identity.source) ||
            typeof identity?.id !== 'string' ||
            !identity.id.trim()
        )
      ) {
        response.code(400).send();
        return;
      }

      const db = getDatabase();
      const matchedIdentities = body.identities.map((identity) => ({
        source: identity.source,
        id: identity.source === 'imdb' ? identity.id.trim().toLowerCase() : identity.id.trim(),
      }));
      const matchedCanonicalItemIds = resolveCanonicalItemIdsForIdentities(db, request.usernameHash, matchedIdentities);
      const usernameHashes =
        body.filters?.listType && body.filters.listType !== 'library'
          ? [request.usernameHash]
          : [request.usernameHash, ...findReadableOwnerHashes(db, request.usernameHash)];

      response.send(
        searchCollectionItems(db, usernameHashes, {
          filters: body.filters,
          offset: parseNumber(body.offset, 0),
          limit: parseNumber(body.limit, 50),
          matchedIdentities,
          matchedCanonicalItemIds,
          viewerUsernameHash: request.usernameHash,
        })
      );
    })
  );
};
