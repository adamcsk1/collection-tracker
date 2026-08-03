import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { findRandomCollectionImages } from '../core/database/repositories/collection';
import { findReadableOwnerHashes } from '../core/database/repositories/share-repository';
import { getDatabase } from '../core/database/database';
import type { FastifyInstance } from 'fastify';

const MAX_IMAGE_COUNT = 50;

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/items/random-images`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const readableOwnerHashes = findReadableOwnerHashes(db, request.usernameHash);
      const count = Math.min(Number((request.query as Record<string, unknown>).count) || 10, MAX_IMAGE_COUNT);
      const images = findRandomCollectionImages(db, request.usernameHash, readableOwnerHashes, count);

      response.send({ images });
    })
  );
};
