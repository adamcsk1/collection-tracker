import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUncompletedApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncTrackingCompletedTagByExternalId } from '../core/database/repositories/collection';
import {
  findOwnTrackingItems,
  findTrackingItemsForLibrarySeries,
} from '../core/database/repositories/tracking-series-repository';
import {
  deleteCompletedEpisodesByExternalId,
  findCompletedEpisodesByExternalId,
} from '../core/database/repositories/series-completed-episodes-repository';
import { findAccessibleShareItemIds } from '../core/database/repositories/share-repository';
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

    const access = findAccessibleShareItemIds(db, request.usernameHash, ownerHash, 'library', ['series'], 'read');
    if (!access.authorized) {
      return response.code(403).send();
    }

    await debugLog(
      `POST /collection-items/actions/mark-series-uncompleted source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
    );
    let changedCount = 0;
    const selectedOwnLibrary = ownerHash === request.usernameHash && typeof query.ownerShareCode !== 'string';
    const trackerItems = selectedOwnLibrary
      ? findOwnTrackingItems(db, request.usernameHash)
      : findTrackingItemsForLibrarySeries(db, request.usernameHash, ownerHash, access.itemIds);

    for (const item of trackerItems) {
      const completedEpisodes = findCompletedEpisodesByExternalId(
        db,
        request.usernameHash,
        item.externalProvider,
        item.externalItemId
      );
      if (!completedEpisodes.length && !item.watchedAt) continue;

      deleteCompletedEpisodesByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId);
      syncTrackingCompletedTagByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId);
      changedCount++;
    }
    await debugLog(`POST /collection-items/actions/mark-series-uncompleted finished: changed=${changedCount}`);

    const result: MarkAllUncompletedApiResponseModel = { changedCount };
    response.send(result);
  });

  app.post(`${API_PREFIX}/collection-items/actions/mark-series-uncompleted`, { preHandler: jwtGuard }, handler);
};
