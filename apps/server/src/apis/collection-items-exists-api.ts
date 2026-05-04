import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { collectionItemExists } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/items/exists`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      if (typeof request.query.imdbId !== 'string' || !request.query.imdbId.trim()) {
        response.sendStatus(400);
        return;
      }

      response.send({ exists: collectionItemExists(getDatabase(), request.usernameHash, request.query.imdbId) });
    })
  );
};
