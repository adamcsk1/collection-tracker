import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { deleteAllBookTrackerItems } from '../core/database/repositories/book-tracker-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/book-tracker`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const changedCount = deleteAllBookTrackerItems(getDatabase(), request.usernameHash);
      response.send({ changedCount });
    })
  );
};
