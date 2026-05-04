import { API_PREFIX } from '@shared/constants/api-const';
import { ChangeApiRequestModel, ChangeApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByImdbId, updateCollectionItem } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';

export const register = (app: Application): void => {
  app.put(
    `${API_PREFIX}/change/:imdbId`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params;
      const { hash } = request.body as ChangeApiRequestModel;
      const item = normalizeItem(request.body as ChangeApiRequestModel);
      if (!item || typeof hash !== 'string') {
        return response.sendStatus(400);
      }
      const db = getDatabase();
      const existingItem = findCollectionItemByImdbId(db, request.usernameHash, `${imdbId}`);

      if (!existingItem) {
        return response.sendStatus(404);
      }

      if (existingItem.content_hash !== hash) {
        return response.sendStatus(409);
      }

      if (item.IMDbId !== imdbId) {
        const conflictItem = findCollectionItemByImdbId(db, request.usernameHash, item.IMDbId);
        if (conflictItem) {
          return response.sendStatus(409);
        }
      }

      const newHash = getItemHash(item);
      const updatedItem = updateCollectionItem(db, request.usernameHash, `${imdbId}`, newHash, item);

      const result: ChangeApiResponseModel = { item: updatedItem! };
      response.send(result);
    })
  );
};
