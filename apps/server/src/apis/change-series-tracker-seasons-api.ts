import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { SeriesTrackerSeasonsApiRequestModel, SeriesTrackerSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncSeriesTrackerCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { replaceSeriesTrackerSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { deleteWatchedEpisodesOutsideSeasonsByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { normalizeSeriesTrackerSeasons } from '../core/utils/series-tracker-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/series-tracker/:externalIdentitySource/:externalIdentityId/seasons`,
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

      const seasons = normalizeSeriesTrackerSeasons(request.body as SeriesTrackerSeasonsApiRequestModel);
      if (!seasons) return response.code(400).send();

      const savedSeasons = replaceSeriesTrackerSeasonsByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId,
        seasons
      );
      deleteWatchedEpisodesOutsideSeasonsByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId,
        savedSeasons
      );
      const item = syncSeriesTrackerCompletedTagByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId
      );
      const result: SeriesTrackerSeasonsApiResponseModel = { seasons: savedSeasons, item };
      response.send(result);
    })
  );
};
