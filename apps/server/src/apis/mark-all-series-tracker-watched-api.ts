import { API_PREFIX } from '@shared/constants/api-const';
import { SeriesTrackerWatchedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncSeriesTrackerCompletedTag } from '../core/database/repositories/collection';
import { findSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { markAllEpisodesWatched } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/series-tracker/:imdbId/mark-all-watched`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      const db = getDatabase();
      const seasons = findSeriesTrackerSeasons(db, request.usernameHash, imdbId);
      if (!seasons.length) return response.code(400).send();

      const savedEpisodes = markAllEpisodesWatched(db, request.usernameHash, imdbId, seasons);
      const item = syncSeriesTrackerCompletedTag(db, request.usernameHash, imdbId);
      const result: SeriesTrackerWatchedEpisodesApiResponseModel = {
        watchedEpisodes: savedEpisodes,
        lastWatchedEpisode: savedEpisodes.length
          ? {
              season: savedEpisodes[savedEpisodes.length - 1].season,
              episode: savedEpisodes[savedEpisodes.length - 1].episode,
            }
          : null,
        item,
      };
      response.send(result);
    })
  );
};
