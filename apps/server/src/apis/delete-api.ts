import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { deleteCollectionItem, findCollectionItemByImdbId } from '../core/database/repositories/collection-repository';
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
      const existingItem = findCollectionItemByImdbId(db, request.usernameHash, `${imdbId}`);

      if (!existingItem) {
        return response.code(404).send();
      }

      if (existingItem.content_hash !== hash) {
        return response.code(409).send();
      }

      deleteCollectionItem(db, request.usernameHash, `${imdbId}`);

      response.code(204).send();
    })
  );
};
