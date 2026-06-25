import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByImdbId } from '../core/database/repositories/collection';
import { deleteMovieTrackerItem } from '../core/database/repositories/movie-tracker-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/movie-tracker/:imdbId`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      const db = getDatabase();
      const existingItem = findCollectionItemByImdbId(db, request.usernameHash, imdbId, 'movie-tracker');
      if (!existingItem) return response.code(404).send();

      deleteMovieTrackerItem(db, request.usernameHash, imdbId);
      response.code(204).send();
    })
  );
};
