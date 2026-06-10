import { API_PREFIX } from '@shared/constants/api-const';
import { SeriesTrackerSeasonsApiRequestModel, SeriesTrackerSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncSeriesTrackerCompletedTag } from '../core/database/repositories/collection';
import { replaceSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { deleteWatchedEpisodesOutsideSeasons } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem, normalizeSeriesTrackerSeasons } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/series-tracker/:imdbId/seasons`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      const seasons = normalizeSeriesTrackerSeasons(request.body as SeriesTrackerSeasonsApiRequestModel);
      if (!seasons) return response.code(400).send();

      const db = getDatabase();
      const savedSeasons = replaceSeriesTrackerSeasons(db, request.usernameHash, imdbId, seasons);
      deleteWatchedEpisodesOutsideSeasons(db, request.usernameHash, imdbId, savedSeasons);
      const item = syncSeriesTrackerCompletedTag(db, request.usernameHash, imdbId);
      const result: SeriesTrackerSeasonsApiResponseModel = { seasons: savedSeasons, item };
      response.send(result);
    })
  );
};
