import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUncompletedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllBooksAsUncompleted } from '../core/database/repositories/tracking-book-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-books-uncompleted`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const query = (request.query ?? {}) as Record<string, unknown>;
      if (typeof query.ownerShareCode === 'string') {
        return response.code(403).send();
      }

      await debugLog(`POST /items/mark-all-books-uncompleted requester=${request.usernameHash}`);
      const changedCount = markAllBooksAsUncompleted(db, request.usernameHash);
      await debugLog(`POST /items/mark-all-books-uncompleted finished: changed=${changedCount}`);

      const result: MarkAllUncompletedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
