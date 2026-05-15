import { API_PREFIX } from '@shared/constants/api-const';
import { WATCH_LATER_TAG, WISHLIST_TAG } from '@shared/constants/tags-const';
import { ChangeApiRequestModel, ChangeApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByImdbId, updateCollectionItem } from '../core/database/repositories/collection-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/change/:imdbId`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      const { hash } = request.body as ChangeApiRequestModel;
      const item = normalizeItem(request.body as ChangeApiRequestModel);
      if (!item || typeof hash !== 'string') {
        return response.code(400).send();
      }

      const db = getDatabase();
      const query = (request.query ?? {}) as Record<string, unknown>;
      const ownerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!ownerHash) {
        return response.code(404).send();
      }

      if (!canAccessLibrary(db, request.usernameHash, ownerHash, 'update')) {
        return response.code(403).send();
      }

      const existingItem = findCollectionItemByImdbId(db, ownerHash, `${imdbId}`, 'library');

      if (!existingItem) {
        return response.code(404).send();
      }

      if (existingItem.content_hash !== hash) {
        return response.code(409).send();
      }

      const internalCollectionTags = [WATCH_LATER_TAG, WISHLIST_TAG];
      const isExistingInternalItem = existingItem.list_type !== 'library';
      if (isExistingInternalItem && ownerHash !== request.usernameHash) {
        return response.code(403).send();
      }
      if (isExistingInternalItem || item.tags.some((tag) => internalCollectionTags.includes(tag))) {
        return response.code(400).send();
      }

      if (item.IMDbId !== imdbId) {
        const conflictItem = findCollectionItemByImdbId(db, ownerHash, item.IMDbId, 'library');
        if (conflictItem) {
          return response.code(409).send();
        }
      }

      const newHash = getItemHash(item);
      const updatedItem = updateCollectionItem(db, ownerHash, `${imdbId}`, newHash, item);

      const result: ChangeApiResponseModel = { item: updatedItem! };
      response.send(result);
    })
  );
};
