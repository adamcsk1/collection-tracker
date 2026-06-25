import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { collectionItemExistsInList, findCollectionItemByImdbId } from '../core/database/repositories/collection';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

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
      const listType = parseListType(query.listType) ?? 'library';

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

      const existingItem = findCollectionItemByImdbId(db, targetOwnerHash, imdbId, listType);
      const isSharedInternalCollectionItem =
        targetOwnerHash !== request.usernameHash && !!existingItem && listType !== 'library';
      const exists = isSharedInternalCollectionItem
        ? false
        : collectionItemExistsInList(db, [targetOwnerHash], imdbId, listType);

      response.send({
        exists,
        hash: exists ? existingItem?.content_hash : undefined,
      });
    })
  );
};
