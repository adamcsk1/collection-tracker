import { API_PREFIX } from '@shared/constants/api-const';
import { CreateApiRequestModel, CreateApiResponseModel } from '@shared/models/api-model';
import { createCollectionItemTagValidation } from '@shared/utils/collection-item-tag-validation-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
  insertCollectionItem,
} from '../core/database/repositories/collection';
import { resolveCanonicalItemIds } from '../core/database/repositories/external-item-identity-repository';
import { replaceWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/create`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as CreateApiRequestModel & { targetOwnerShareCode?: string };
      const item = normalizeItem(body);
      const listType = parseListType(body.listType) ?? 'library';
      if (!item) {
        return response.code(400).send();
      }

      const tagValidationError = createCollectionItemTagValidation({
        contentType: item.contentType,
        favorite: item.favorite,
        listType,
        targetOwnerShareCode: body.targetOwnerShareCode,
      });
      if (tagValidationError) return response.code(400).send();

      const db = getDatabase();
      const targetOwnerHash =
        typeof body.targetOwnerShareCode === 'string'
          ? findUserByShareCode(db, body.targetOwnerShareCode)?.username_hash
          : request.usernameHash;
      if (!targetOwnerHash) {
        return response.code(404).send();
      }

      if (!canAccessLibrary(db, request.usernameHash, targetOwnerHash, 'create')) {
        return response.code(403).send();
      }

      const canonicalItemIds = resolveCanonicalItemIds(
        db,
        targetOwnerHash,
        item.externalProvider,
        item.externalItemId,
        item.externalIds
      );
      const existingItem =
        canonicalItemIds
          .map((canonicalItemId) => findCollectionItemByCanonicalItemId(db, targetOwnerHash, canonicalItemId, listType))
          .find((collectionItem) => !!collectionItem) ??
        findCollectionItemByExternalId(db, targetOwnerHash, item.externalProvider, item.externalItemId, listType);
      if (existingItem) {
        return response.code(409).send();
      }

      const hash = getItemHash(item);
      const createdItem = insertCollectionItem(db, targetOwnerHash, hash, item, listType);

      if (listType === 'watching') {
        const seasons = await fetchSeriesSeasonMetadata(item.externalProvider, item.externalItemId);
        if (seasons.length) {
          replaceWatchingSeasonsByExternalId(db, targetOwnerHash, item.externalProvider, item.externalItemId, seasons);
        }
      }

      const result: CreateApiResponseModel = { item: createdItem };
      response.send(result);
    })
  );
};
