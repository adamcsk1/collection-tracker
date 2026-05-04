import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { deleteCollectionItem, findCollectionItemByImdbId } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.delete(
    `${API_PREFIX}/delete/:imdbId`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params;
      const { hash } = request.query as { hash: string };
      if (typeof hash !== 'string') {
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

      deleteCollectionItem(db, request.usernameHash, `${imdbId}`);

      response.sendStatus(204);
    })
  );
};
