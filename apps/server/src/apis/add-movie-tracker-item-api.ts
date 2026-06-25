import { API_PREFIX } from '@shared/constants/api-const';
import { MovieTrackerApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { copyMovieToMovieTracker } from '../core/database/repositories/movie-tracker-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

const findSourceOwnerHash = (query: Record<string, unknown>, requesterUsernameHash: string): string | null => {
  if (typeof query.ownerShareCode !== 'string') return requesterUsernameHash;
  return findUserByShareCode(getDatabase(), query.ownerShareCode)?.username_hash ?? null;
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/movie-tracker/:imdbId`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      const query = (request.query ?? {}) as Record<string, unknown>;
      const db = getDatabase();
      const sourceOwnerHash = findSourceOwnerHash(query, request.usernameHash);
      if (!sourceOwnerHash) return response.code(404).send();
      if (!canAccessLibrary(db, request.usernameHash, sourceOwnerHash, 'read')) return response.code(403).send();
      const sourceListType = parseListType(query.sourceListType) ?? 'library';
      if (sourceListType !== 'library' && sourceListType !== 'watch-later') return response.code(400).send();
      const moveFromWatchLater = sourceListType === 'watch-later';
      if (moveFromWatchLater && sourceOwnerHash !== request.usernameHash) return response.code(403).send();

      const item = copyMovieToMovieTracker(
        db,
        request.usernameHash,
        sourceOwnerHash,
        imdbId,
        sourceListType,
        moveFromWatchLater
      );
      if (!item) return response.code(404).send();

      const result: MovieTrackerApiResponseModel = { item };
      response.send(result);
    })
  );
};
