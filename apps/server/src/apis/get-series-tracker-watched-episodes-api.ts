import { API_PREFIX } from '@shared/constants/api-const';
import { SeriesTrackerWatchedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findWatchedEpisodes,
  findLastWatchedEpisode,
} from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/series-tracker/:imdbId/watched-episodes`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      const db = getDatabase();
      const watchedEpisodes = findWatchedEpisodes(db, request.usernameHash, imdbId);
      const lastWatchedEpisode = findLastWatchedEpisode(db, request.usernameHash, imdbId);
      const result: SeriesTrackerWatchedEpisodesApiResponseModel = { watchedEpisodes, lastWatchedEpisode };
      response.send(result);
    })
  );
};
