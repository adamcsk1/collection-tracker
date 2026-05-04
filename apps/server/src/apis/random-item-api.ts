import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { findRandomCollectionItem } from '../core/database/repositories/collection-repository';
import { getDatabase } from '../core/database/database';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/items/random`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const item = findRandomCollectionItem(getDatabase(), request.usernameHash);

      if (!item) {
        response.sendStatus(404);
        return;
      }

      response.send(item);
    })
  );
};
