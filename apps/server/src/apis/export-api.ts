import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { findUserSettings } from '../core/database/repositories/user-repository';
import { findTagManagement } from '../core/database/repositories/tag-management-repository';
import { findAllCollectionItemsByUser } from '../core/database/repositories/collection/collection-read-repository';
import { findSeriesTrackerSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { findWatchedEpisodesByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { UserExportApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';

const getSeriesTrackerDataKey = (externalProvider: string, externalItemId: string): string =>
  `${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}`;

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/export`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const db = getDatabase();
      const usernameHash = request.usernameHash;

      const userSettings = findUserSettings(db, usernameHash) ?? {};
      const tagManagement = findTagManagement(db, usernameHash);
      const collectionItems = findAllCollectionItemsByUser(db, usernameHash);

      const seriesTrackerData: UserExportApiResponseModel['seriesTrackerData'] = {};
      for (const item of collectionItems) {
        if (item.listType === 'series-tracker') {
          const seriesTrackerDataKey = getSeriesTrackerDataKey(item.externalProvider, item.externalItemId);
          seriesTrackerData[seriesTrackerDataKey] = {
            seasons: findSeriesTrackerSeasonsByExternalId(db, usernameHash, item.externalProvider, item.externalItemId),
            watchedEpisodes: findWatchedEpisodesByExternalId(
              db,
              usernameHash,
              item.externalProvider,
              item.externalItemId
            ),
          };
        }
      }

      const result: UserExportApiResponseModel = {
        userSettings,
        collectionItems,
        tagManagement,
        seriesTrackerData,
      };

      response.send(result);
    })
  );
};
