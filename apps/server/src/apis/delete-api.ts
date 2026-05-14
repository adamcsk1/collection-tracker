import { API_PREFIX } from '@shared/constants/api-const';
import { WATCH_LATER_TAG } from '@shared/constants/tags-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  collectionItemHasTag,
  deleteCollectionItem,
  findCollectionItemByImdbId,
} from '../core/database/repositories/collection-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/delete/:imdbId`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      const { hash } = request.query as Record<string, unknown> as { hash: string };
      if (typeof hash !== 'string') {
        return response.code(400).send();
      }

      const db = getDatabase();
      const query = request.query as Record<string, unknown>;
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

      const existingItem = findCollectionItemByImdbId(db, ownerHash, `${imdbId}`);

      if (!existingItem) {
        return response.code(404).send();
      }

      if (existingItem.content_hash !== hash) {
        return response.code(409).send();
      }

      const isWatchLaterItem = collectionItemHasTag(db, existingItem.id, WATCH_LATER_TAG);
      if (isWatchLaterItem && ownerHash !== request.usernameHash) {
        return response.code(403).send();
      }

      deleteCollectionItem(db, ownerHash, `${imdbId}`);

      response.code(204).send();
    })
  );
};
