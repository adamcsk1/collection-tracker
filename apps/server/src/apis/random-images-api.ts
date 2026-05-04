import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { findRandomCollectionImages } from '../core/database/repositories/collection-repository';
import { getDatabase } from '../core/database/database';
import type { Application } from 'express';

const MAX_IMAGE_COUNT = 50;

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/items/random-images`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const count = Math.min(Number(request.query.count) || 10, MAX_IMAGE_COUNT);
      const images = findRandomCollectionImages(getDatabase(), request.usernameHash, count);

      response.send({ images });
    })
  );
};
