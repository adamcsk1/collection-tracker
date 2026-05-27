import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUnwatchedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllAsUnwatched } from '../core/database/repositories/collection';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-unwatched`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const changedCount = markAllAsUnwatched(db, request.usernameHash);

      const result: MarkAllUnwatchedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
