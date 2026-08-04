import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { deleteWatchedItemByExternalId } from '../core/database/repositories/movie-tracker-repository';
import { resolveCanonicalItemId } from '../core/database/repositories/external-item-identity-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const db = getDatabase();
    const canonicalItemId = resolveCanonicalItemId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const existingItem =
      findCollectionItemByCanonicalItemId(db, request.usernameHash, canonicalItemId, 'finished') ??
      findCollectionItemByExternalId(db, request.usernameHash, externalIdentitySource, externalIdentityId, 'finished');
    if (!existingItem) return response.code(404).send();

    deleteWatchedItemByExternalId(
      db,
      request.usernameHash,
      existingItem.external_provider,
      existingItem.external_item_id ?? existingItem.imdb_id ?? ''
    );
    response.code(204).send();
  });

  app.delete(`${API_PREFIX}/finished/:externalIdentitySource/:externalIdentityId`, { preHandler: jwtGuard }, handler);
};
