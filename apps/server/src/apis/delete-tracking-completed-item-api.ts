import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { deleteCompletedBookByExternalId } from '../core/database/repositories/tracking-book-repository';
import { deleteCompletedItemByExternalId } from '../core/database/repositories/tracking-movie-repository';
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
      findCollectionItemByCanonicalItemId(db, request.usernameHash, canonicalItemId, 'tracking') ??
      findCollectionItemByExternalId(db, request.usernameHash, externalIdentitySource, externalIdentityId, 'tracking');
    if (!existingItem) return response.code(404).send();

    const externalProvider = existingItem.external_provider;
    const externalItemId = existingItem.external_item_id ?? existingItem.imdb_id ?? '';
    if (existingItem.content_type === 'book') {
      deleteCompletedBookByExternalId(db, request.usernameHash, externalProvider, externalItemId);
    } else {
      deleteCompletedItemByExternalId(db, request.usernameHash, externalProvider, externalItemId);
    }
    response.code(204).send();
  });

  // Clears completion on a movie/book tracking twin (mark unfinished). Movies are pruned after clear; books stay unfinished.
  app.delete(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/completed`,
    { preHandler: jwtGuard },
    handler
  );
};
