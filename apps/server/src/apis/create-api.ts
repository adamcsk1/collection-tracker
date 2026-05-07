import { API_PREFIX } from '@shared/constants/api-const';
import { CreateApiRequestModel, CreateApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByImdbId, insertCollectionItem } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/create`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const item = normalizeItem(request.body as CreateApiRequestModel);
      if (!item) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const existingItem = findCollectionItemByImdbId(db, request.usernameHash, item.IMDbId);
      if (existingItem) {
        return response.code(409).send();
      }

      const hash = getItemHash(item);
      const createdItem = insertCollectionItem(db, request.usernameHash, hash, item);

      const result: CreateApiResponseModel = { item: createdItem };
      response.send(result);
    })
  );
};
