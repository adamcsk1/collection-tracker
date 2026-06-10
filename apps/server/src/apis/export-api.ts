import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { findUserSettings } from '../core/database/repositories/user-repository';
import { findTagManagement } from '../core/database/repositories/tag-management-repository';
import { findAllCollectionItemsByUser } from '../core/database/repositories/collection/collection-read-repository';
import { findSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { findWatchedEpisodes } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { UserExportApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';

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
          const imdbId = item.IMDbId;
          seriesTrackerData[imdbId] = {
            seasons: findSeriesTrackerSeasons(db, usernameHash, imdbId),
            watchedEpisodes: findWatchedEpisodes(db, usernameHash, imdbId),
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
