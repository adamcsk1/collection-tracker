import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { findRandomCollectionItem } from '../core/database/repositories/collection-repository';
import { getDatabase } from '../core/database/database';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/items/random`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const item = findRandomCollectionItem(getDatabase(), request.usernameHash);

      if (!item) {
        response.code(404).send();
        return;
      }

      response.send(item);
    })
  );
};
