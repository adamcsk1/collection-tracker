import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncTrackingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { deleteTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { deleteCompletedEpisodesByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

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

    deleteTrackingSeasonsByExternalId(db, request.usernameHash, externalIdentitySource, externalIdentityId);
    deleteCompletedEpisodesByExternalId(db, request.usernameHash, externalIdentitySource, externalIdentityId);
    const item = syncTrackingCompletedTagByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const result: TrackingSeasonsApiResponseModel = { seasons: [], item };
    response.send(result);
  });

  app.delete(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/seasons`,
    { preHandler: jwtGuard },
    handler
  );
};
