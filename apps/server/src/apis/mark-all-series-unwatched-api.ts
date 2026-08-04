import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUnwatchedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncWatchingCompletedTagByExternalId } from '../core/database/repositories/collection';
import {
  findOwnWatchingItems,
  findWatchingItemsForLibrarySeries,
} from '../core/database/repositories/series-tracker-repository';
import {
  deleteWatchedEpisodesByExternalId,
  findWatchedEpisodesByExternalId,
} from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-series-unwatched`,
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

      if (!canAccessLibrary(db, request.usernameHash, ownerHash, 'read')) {
        return response.code(403).send();
      }

      await debugLog(
        `POST /items/mark-all-series-unwatched source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
      );
      let changedCount = 0;
      const selectedOwnLibrary = ownerHash === request.usernameHash && typeof query.ownerShareCode !== 'string';
      const trackerItems = selectedOwnLibrary
        ? findOwnWatchingItems(db, request.usernameHash)
        : findWatchingItemsForLibrarySeries(db, request.usernameHash, ownerHash);

      for (const item of trackerItems) {
        const watchedEpisodes = findWatchedEpisodesByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId
        );
        if (!watchedEpisodes.length && !item.watchedAt) continue;

        deleteWatchedEpisodesByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId);
        syncWatchingCompletedTagByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId);
        changedCount++;
      }
      await debugLog(`POST /items/mark-all-series-unwatched finished: changed=${changedCount}`);

      const result: MarkAllUnwatchedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
