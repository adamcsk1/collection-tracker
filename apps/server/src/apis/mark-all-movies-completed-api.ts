import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllCompletedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllMoviesAsCompleted } from '../core/database/repositories/tracking-movie-repository';
import { canAccessShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const db = getDatabase();
    const query = (request.query ?? {}) as Record<string, unknown>;
    const ownerHash =
      typeof query.ownerShareCode === 'string'
        ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
        : request.usernameHash;
    if (!ownerHash) {
      return response.code(404).send();
    }

    if (!canAccessShare(db, request.usernameHash, ownerHash, 'library', 'movie', 'read')) {
      return response.code(403).send();
    }

    await debugLog(
      `POST /collection-items/actions/mark-movies-completed source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
    );
    const changedCount = markAllMoviesAsCompleted(db, request.usernameHash, ownerHash);
    await debugLog(`POST /collection-items/actions/mark-movies-completed finished: changed=${changedCount}`);

    const result: MarkAllCompletedApiResponseModel = { changedCount };
    response.send(result);
  });

  app.post(`${API_PREFIX}/collection-items/actions/mark-movies-completed`, { preHandler: jwtGuard }, handler);
};
