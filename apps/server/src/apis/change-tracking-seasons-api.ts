import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingSeasonsApiRequestModel, TrackingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncTrackingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { replaceTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { deleteCompletedEpisodesOutsideSeasonsByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { normalizeTrackingSeasons } from '../core/utils/tracking-seasons-api-util';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const db = getDatabase();
    if (
      !findCollectionItemByExternalIdOrCanonicalItemId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId,
        'tracking'
      )
    ) {
      return response.code(404).send();
    }

    const seasons = normalizeTrackingSeasons(request.body as TrackingSeasonsApiRequestModel);
    if (!seasons) return response.code(400).send();

    const savedSeasons = replaceTrackingSeasonsByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId,
      seasons
    );
    deleteCompletedEpisodesOutsideSeasonsByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId,
      savedSeasons
    );
    const item = syncTrackingCompletedTagByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const result: TrackingSeasonsApiResponseModel = { seasons: savedSeasons, item };
    response.send(result);
  });

  app.put(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/seasons`,
    { preHandler: jwtGuard },
    handler
  );
};
