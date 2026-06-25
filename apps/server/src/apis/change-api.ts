import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeApiRequestModel, ChangeApiResponseModel } from '@shared/models/api-model';
import { changeCollectionItemTagValidation } from '@shared/utils/collection-item-tag-validation-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByImdbId,
  syncSeriesTrackerCompletedTag,
  updateCollectionItem,
} from '../core/database/repositories/collection';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { parseListType } from '../core/utils/query-parse-util';

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
      const listType = parseListType(query.listType) ?? 'library';
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

      const existingItem = findCollectionItemByImdbId(db, ownerHash, `${imdbId}`, listType);

      if (!existingItem) {
        return response.code(404).send();
      }

      if (existingItem.content_hash !== hash) {
        return response.code(409).send();
      }

      const tagValidationError = changeCollectionItemTagValidation({
        contentType: item.contentType,
        favorite: item.favorite,
        listType,
        existingListType: existingItem.list_type,
        requesterIsOwner: ownerHash === request.usernameHash,
      });
      if (tagValidationError) {
        const status = tagValidationError.kind === 'sharedInternalCollectionItemUpdate' ? 403 : 400;
        return response.code(status).send();
      }

      if (item.IMDbId !== imdbId) {
        const conflictItem = findCollectionItemByImdbId(db, ownerHash, item.IMDbId, listType);
        if (conflictItem) {
          return response.code(409).send();
        }
      }

      const newHash = getItemHash(item);
      let updatedItem = updateCollectionItem(db, ownerHash, `${imdbId}`, newHash, item, listType);
      if (listType === 'series-tracker') {
        updatedItem = syncSeriesTrackerCompletedTag(db, ownerHash, item.IMDbId) ?? updatedItem;
      }

      const result: ChangeApiResponseModel = { item: updatedItem! };
      response.send(result);
    })
  );
};
