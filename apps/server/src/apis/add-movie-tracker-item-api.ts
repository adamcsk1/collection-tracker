import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { copyMovieToWatchedByExternalId } from '../core/database/repositories/movie-tracker-repository';
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
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    const query = (request.query ?? {}) as Record<string, unknown>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const db = getDatabase();
    const sourceOwnerHash = findSourceOwnerHash(query, request.usernameHash);
    if (!sourceOwnerHash) return response.code(404).send();
    if (!canAccessLibrary(db, request.usernameHash, sourceOwnerHash, 'read')) return response.code(403).send();
    const sourceListType = parseListType(query.sourceListType) ?? 'library';
    if (sourceListType !== 'library' && sourceListType !== 'watchlist' && sourceListType !== 'books') {
      return response.code(400).send();
    }
    const moveFromWatchlist = sourceListType === 'watchlist';
    if (moveFromWatchlist && sourceOwnerHash !== request.usernameHash) return response.code(403).send();
    if (sourceListType === 'books' && sourceOwnerHash !== request.usernameHash) return response.code(403).send();

    const item = copyMovieToWatchedByExternalId(
      db,
      request.usernameHash,
      sourceOwnerHash,
      externalIdentitySource,
      externalIdentityId,
      sourceListType,
      moveFromWatchlist
    );
    if (!item) return response.code(404).send();

    const result: WatchedApiResponseModel = { item };
    response.send(result);
  });

  app.post(`${API_PREFIX}/finished/:externalIdentitySource/:externalIdentityId`, { preHandler: jwtGuard }, handler);
};
