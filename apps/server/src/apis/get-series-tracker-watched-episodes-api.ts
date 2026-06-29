import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { SeriesTrackerWatchedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByExternalIdOrCanonicalItemId } from '../core/database/repositories/collection';
import {
  findWatchedEpisodesByExternalId,
  findLastWatchedEpisodeByExternalId,
} from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/series-tracker/:externalIdentitySource/:externalIdentityId/watched-episodes`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
      const db = getDatabase();
      if (
        !findCollectionItemByExternalIdOrCanonicalItemId(
          db,
          request.usernameHash,
          externalIdentitySource,
          externalIdentityId,
          'series-tracker'
        )
      ) {
        return response.code(404).send();
      }

      const watchedEpisodes = findWatchedEpisodesByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId
      );
      const lastWatchedEpisode = findLastWatchedEpisodeByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId
      );
      const result: SeriesTrackerWatchedEpisodesApiResponseModel = { watchedEpisodes, lastWatchedEpisode };
      response.send(result);
    })
  );
};
