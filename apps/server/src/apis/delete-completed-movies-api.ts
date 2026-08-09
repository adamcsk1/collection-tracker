import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { deleteAllCompletedItems } from '../core/database/repositories/tracking-movie-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const changedCount = deleteAllCompletedItems(getDatabase(), request.usernameHash);
    response.send({ changedCount });
  });

  app.delete(`${API_PREFIX}/tracking/completed-movies`, { preHandler: jwtGuard }, handler);
};
