import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  deleteCollectionItemByExternalId,
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { resolveCanonicalItemId } from '../core/database/repositories/external-item-identity-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/items/:externalIdentitySource/:externalIdentityId`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      const { hash } = request.query as Record<string, unknown> as { hash: string };
      if (typeof hash !== 'string' || !isExternalItemIdentitySourceName(externalIdentitySource)) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const query = request.query as Record<string, unknown>;
      const listType = parseListType(query.listType) ?? 'library';
      const ownerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!ownerHash) {
        return response.code(404).send();
      }

      if (!canAccessLibrary(db, request.usernameHash, ownerHash, 'delete')) {
        return response.code(403).send();
      }

      const canonicalItemId = resolveCanonicalItemId(db, ownerHash, externalIdentitySource, externalIdentityId);
      const existingItem =
        findCollectionItemByCanonicalItemId(db, ownerHash, canonicalItemId, listType) ??
        findCollectionItemByExternalId(db, ownerHash, externalIdentitySource, externalIdentityId, listType);

      if (!existingItem) {
        return response.code(404).send();
      }

      if (existingItem.content_hash !== hash) {
        return response.code(409).send();
      }

      const isInternalCollectionItem = listType !== 'library';
      if (isInternalCollectionItem && ownerHash !== request.usernameHash) {
        return response.code(403).send();
      }

      deleteCollectionItemByExternalId(
        db,
        ownerHash,
        existingItem.external_provider,
        existingItem.external_item_id ?? existingItem.imdb_id ?? '',
        listType
      );

      response.code(204).send();
    })
  );
};
