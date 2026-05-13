import { API_PREFIX } from '@shared/constants/api-const';
import { CreateApiRequestModel, CreateApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByImdbId, insertCollectionItem } from '../core/database/repositories/collection-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/create`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as CreateApiRequestModel & { targetOwnerShareCode?: string };
      const item = normalizeItem(body);
      if (!item) {
        return response.code(400).send();
      }

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

      const existingItem = findCollectionItemByImdbId(db, targetOwnerHash, item.IMDbId);
      if (existingItem) {
        return response.code(409).send();
      }

      const hash = getItemHash(item);
      const createdItem = insertCollectionItem(db, targetOwnerHash, hash, item);

      const result: CreateApiResponseModel = { item: createdItem };
      response.send(result);
    })
  );
};
