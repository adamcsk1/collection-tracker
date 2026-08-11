import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllCompletedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllBooksAsCompleted } from '../core/database/repositories/tracking-book-repository';
import { findAccessibleShareItemIds } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/collection-items/actions/mark-books-completed`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const query = (request.query ?? {}) as Record<string, unknown>;
      const ownerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!ownerHash) {
        return response.code(404).send();
      }

      const access = findAccessibleShareItemIds(db, request.usernameHash, ownerHash, 'books', ['book'], 'read');
      if (!access.authorized) {
        return response.code(403).send();
      }

      await debugLog(
        `POST /collection-items/actions/mark-books-completed source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
      );
      const changedCount = markAllBooksAsCompleted(db, request.usernameHash, ownerHash, access.itemIds);
      await debugLog(`POST /collection-items/actions/mark-books-completed finished: changed=${changedCount}`);

      const result: MarkAllCompletedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
