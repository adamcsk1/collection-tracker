import { API_PREFIX } from '@shared/constants/api-const';
import { SeriesTrackerSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncSeriesTrackerCompletedTag } from '../core/database/repositories/collection';
import { replaceSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { jwtGuard } from '../core/jwt';
import { fetchSeriesSeasonMetadata } from '../core/omdb/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/series-tracker/:imdbId/seasons/refresh`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      const seasons = await fetchSeriesSeasonMetadata(imdbId);
      const db = getDatabase();
      const savedSeasons = replaceSeriesTrackerSeasons(db, request.usernameHash, imdbId, seasons);
      const item = syncSeriesTrackerCompletedTag(db, request.usernameHash, imdbId);
      const result: SeriesTrackerSeasonsApiResponseModel = { seasons: savedSeasons, item };
      response.send(result);
    })
  );
};
