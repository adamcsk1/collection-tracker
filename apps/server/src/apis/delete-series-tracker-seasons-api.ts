import { API_PREFIX } from '@shared/constants/api-const';
import { SeriesTrackerSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { deleteSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/series-tracker/:imdbId/seasons`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      deleteSeriesTrackerSeasons(getDatabase(), request.usernameHash, imdbId);
      const result: SeriesTrackerSeasonsApiResponseModel = { seasons: [] };
      response.send(result);
    })
  );
};
