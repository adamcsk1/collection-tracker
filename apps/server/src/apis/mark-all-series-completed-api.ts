import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllSeriesCompletedApiResponseModel, TrackingCompletedEpisodeModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncTrackingCompletedTagByExternalId } from '../core/database/repositories/collection';
import {
  findTrackingSeasonsByExternalId,
  replaceTrackingSeasonsByExternalId,
} from '../core/database/repositories/tracking-season-repository';
import {
  findOwnTrackingItems,
  findTrackingItemsForLibrarySeries,
  markAllSeriesAsCompleted,
} from '../core/database/repositories/tracking-series-repository';
import {
  findCompletedEpisodesByExternalId,
  markAllEpisodesCompletedByExternalId,
} from '../core/database/repositories/series-completed-episodes-repository';
import { findAccessibleShareItemIds } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { tryFetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';

const completedEpisodesEqual = (
  firstEpisodes: TrackingCompletedEpisodeModel[],
  secondEpisodes: TrackingCompletedEpisodeModel[]
): boolean =>
  firstEpisodes.length === secondEpisodes.length &&
  firstEpisodes.every(
    (episode, index) =>
      episode.season === secondEpisodes[index].season && episode.episode === secondEpisodes[index].episode
  );

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
      `POST /collection-items/actions/mark-series-completed source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
    );
    const insertedItems = markAllSeriesAsCompleted(db, request.usernameHash, ownerHash, access.itemIds);
    const selectedOwnLibrary = ownerHash === request.usernameHash && typeof query.ownerShareCode !== 'string';

    for (const item of insertedItems) {
      const seasons = await tryFetchSeriesSeasonMetadata(item.externalProvider, item.externalItemId);
      if (!seasons.length) continue;

      replaceTrackingSeasonsByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId, seasons);
    }

    const trackerItems = selectedOwnLibrary
      ? findOwnTrackingItems(db, request.usernameHash)
      : findTrackingItemsForLibrarySeries(db, request.usernameHash, ownerHash, access.itemIds);
    let progressChangedCount = 0;

    for (const item of trackerItems) {
      const seasons = findTrackingSeasonsByExternalId(
        db,
        request.usernameHash,
        item.externalProvider,
        item.externalItemId
      );
      if (!seasons.length) continue;

      const existingCompletedEpisodes = findCompletedEpisodesByExternalId(
        db,
        request.usernameHash,
        item.externalProvider,
        item.externalItemId
      );
      const wasCompleted = Boolean(item.watchedAt);
      const completedEpisodes = markAllEpisodesCompletedByExternalId(
        db,
        request.usernameHash,
        item.externalProvider,
        item.externalItemId,
        seasons
      );
      const syncedItem = syncTrackingCompletedTagByExternalId(
        db,
        request.usernameHash,
        item.externalProvider,
        item.externalItemId
      );
      const isCompleted = Boolean(syncedItem?.watchedAt);
      if (!completedEpisodesEqual(existingCompletedEpisodes, completedEpisodes) || wasCompleted !== isCompleted) {
        progressChangedCount++;
      }
    }
    await debugLog(
      `POST /collection-items/actions/mark-series-completed finished: tracked=${insertedItems.length}, progressChanged=${progressChangedCount}`
    );

    const result: MarkAllSeriesCompletedApiResponseModel = {
      trackedCount: insertedItems.length,
      progressChangedCount,
    };
    response.send(result);
  });

  app.post(`${API_PREFIX}/collection-items/actions/mark-series-completed`, { preHandler: jwtGuard }, handler);
};
