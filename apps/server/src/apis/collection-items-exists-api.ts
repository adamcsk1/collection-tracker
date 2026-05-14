import { API_PREFIX } from '@shared/constants/api-const';
import { WATCH_LATER_TAG, WISHLIST_TAG } from '@shared/constants/tags-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  collectionItemExists,
  collectionItemHasTag,
  findCollectionItemByImdbId,
} from '../core/database/repositories/collection-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/items/exists`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const imdbId = query.imdbId;
      if (typeof imdbId !== 'string' || !imdbId.trim()) {
        response.code(400).send();
        return;
      }

      const db = getDatabase();
      const targetOwnerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!targetOwnerHash) {
        response.code(404).send();
        return;
      }

      if (!canAccessLibrary(db, request.usernameHash, targetOwnerHash, 'read')) {
        response.code(403).send();
        return;
      }

      const existingItem = findCollectionItemByImdbId(db, targetOwnerHash, imdbId);
      const isSharedInternalCollectionItem =
        targetOwnerHash !== request.usernameHash &&
        !!existingItem &&
        (collectionItemHasTag(db, existingItem.id, WATCH_LATER_TAG) ||
          collectionItemHasTag(db, existingItem.id, WISHLIST_TAG));

      response.send({
        exists: isSharedInternalCollectionItem ? false : collectionItemExists(db, [targetOwnerHash], imdbId),
      });
    })
  );
};
