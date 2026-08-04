import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllSeriesWatchedApiResponseModel, WatchingWatchedEpisodeModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncWatchingCompletedTagByExternalId } from '../core/database/repositories/collection';
import {
  findWatchingSeasonsByExternalId,
  replaceWatchingSeasonsByExternalId,
} from '../core/database/repositories/series-tracker-season-repository';
import {
  findOwnWatchingItems,
  findWatchingItemsForLibrarySeries,
  markAllSeriesAsWatched,
} from '../core/database/repositories/series-tracker-repository';
import {
  findWatchedEpisodesByExternalId,
  markAllEpisodesWatchedByExternalId,
} from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';

const watchedEpisodesEqual = (
  firstEpisodes: WatchingWatchedEpisodeModel[],
  secondEpisodes: WatchingWatchedEpisodeModel[]
): boolean =>
  firstEpisodes.length === secondEpisodes.length &&
  firstEpisodes.every(
    (episode, index) =>
      episode.season === secondEpisodes[index].season && episode.episode === secondEpisodes[index].episode
  );

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-series-watched`,
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
        `POST /items/mark-all-series-watched source owner resolved: ownerShareCode=${query.ownerShareCode ?? ''}, requester=${request.usernameHash}, sourceOwner=${ownerHash}`
      );
      const insertedItems = markAllSeriesAsWatched(db, request.usernameHash, ownerHash);
      const selectedOwnLibrary = ownerHash === request.usernameHash && typeof query.ownerShareCode !== 'string';

      for (const item of insertedItems) {
        const seasons = await fetchSeriesSeasonMetadata(item.externalProvider, item.externalItemId);
        if (!seasons.length) continue;

        replaceWatchingSeasonsByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId,
          seasons
        );
      }

      const trackerItems = selectedOwnLibrary
        ? findOwnWatchingItems(db, request.usernameHash)
        : findWatchingItemsForLibrarySeries(db, request.usernameHash, ownerHash);
      let progressChangedCount = 0;

      for (const item of trackerItems) {
        const seasons = findWatchingSeasonsByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId
        );
        if (!seasons.length) continue;

        const existingWatchedEpisodes = findWatchedEpisodesByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId
        );
        const wasCompleted = Boolean(item.watchedAt);
        const watchedEpisodes = markAllEpisodesWatchedByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId,
          seasons
        );
        const syncedItem = syncWatchingCompletedTagByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId
        );
        const isCompleted = Boolean(syncedItem?.watchedAt);
        if (!watchedEpisodesEqual(existingWatchedEpisodes, watchedEpisodes) || wasCompleted !== isCompleted) {
          progressChangedCount++;
        }
      }
      await debugLog(
        `POST /items/mark-all-series-watched finished: tracked=${insertedItems.length}, progressChanged=${progressChangedCount}`
      );

      const result: MarkAllSeriesWatchedApiResponseModel = {
        trackedCount: insertedItems.length,
        progressChangedCount,
      };
      response.send(result);
    })
  );
};
