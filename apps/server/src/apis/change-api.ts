import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { ChangeApiRequestModel, ChangeApiResponseModel } from '@shared/models/api-model';
import { changeCollectionItemTagValidation } from '@shared/utils/collection-item-tag-validation-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalId,
  findCollectionItemByExternalIdOrCanonicalItemId,
  findCollectionItemByImdbId,
  findCollectionItemByCanonicalItemId,
  syncSeriesTrackerCompletedTagByExternalId,
  updateCollectionItemByRow,
} from '../core/database/repositories/collection';
import { resolveCanonicalItemIds } from '../core/database/repositories/external-item-identity-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/items/:externalIdentitySource/:externalIdentityId/change`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
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

      const existingItem = findCollectionItemByExternalIdOrCanonicalItemId(
        db,
        ownerHash,
        externalIdentitySource,
        externalIdentityId,
        listType
      );
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

      if (item.IMDbId && item.IMDbId !== existingItem.imdb_id) {
        const conflictItem = findCollectionItemByImdbId(db, ownerHash, item.IMDbId, listType);
        if (conflictItem) {
          return response.code(409).send();
        }
      }

      const externalConflictItem = findCollectionItemByExternalId(
        db,
        ownerHash,
        item.externalProvider,
        item.externalItemId,
        listType
      );
      if (externalConflictItem && externalConflictItem.id !== existingItem.id) {
        return response.code(409).send();
      }

      const canonicalItemIds = resolveCanonicalItemIds(
        db,
        ownerHash,
        item.externalProvider,
        item.externalItemId,
        item.externalIds
      );
      const canonicalConflictItem = canonicalItemIds
        .map((canonicalItemId) => findCollectionItemByCanonicalItemId(db, ownerHash, canonicalItemId, listType))
        .find((collectionItem) => !!collectionItem);
      if (canonicalConflictItem && canonicalConflictItem.id !== existingItem.id) {
        return response.code(409).send();
      }

      const newHash = getItemHash(item);
      let updatedItem = updateCollectionItemByRow(db, ownerHash, existingItem, newHash, item, listType);
      if (listType === 'series-tracker') {
        updatedItem =
          syncSeriesTrackerCompletedTagByExternalId(db, ownerHash, item.externalProvider, item.externalItemId) ??
          updatedItem;
      }

      const result: ChangeApiResponseModel = { item: updatedItem! };
      response.send(result);
    })
  );
};
