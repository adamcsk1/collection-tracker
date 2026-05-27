import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllWatchedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllAsWatched } from '../core/database/repositories/collection';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-watched`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const changedCount = markAllAsWatched(db, request.usernameHash);

      const result: MarkAllWatchedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
