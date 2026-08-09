import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUncompletedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { markAllMoviesAsUncompleted } from '../core/database/repositories/tracking-movie-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

const MOVIE_MARK_ALL_UNCOMPLETED_PATHS = [
  `${API_PREFIX}/items/mark-all-movies-uncompleted`,
  `${API_PREFIX}/items/mark-all-uncompleted`,
  `${API_PREFIX}/items/mark-all-unwatched`,
] as const;

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

    if (!canAccessLibrary(db, request.usernameHash, ownerHash, 'read')) {
      return response.code(403).send();
    }

    await debugLog(
      `POST /items/mark-all-movies-uncompleted source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
    );
    const changedCount = markAllMoviesAsUncompleted(db, request.usernameHash, ownerHash);
    await debugLog(`POST /items/mark-all-movies-uncompleted finished: changed=${changedCount}`);

    const result: MarkAllUncompletedApiResponseModel = { changedCount };
    response.send(result);
  });

  for (const path of MOVIE_MARK_ALL_UNCOMPLETED_PATHS) {
    app.post(path, { preHandler: jwtGuard }, handler);
  }
};
