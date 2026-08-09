import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { findRandomCollectionImages } from '../core/database/repositories/collection';
import { getDatabase } from '../core/database/database';
import type { FastifyInstance } from 'fastify';

const MAX_IMAGE_COUNT = 50;

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/random-images`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const requestedCount = Math.floor(Number((request.query as Record<string, unknown>).count)) || 10;
      const count = Math.min(Math.max(requestedCount, 1), MAX_IMAGE_COUNT);
      const images = findRandomCollectionImages(db, request.usernameHash, count);

      response.send({ images });
    })
  );
};
