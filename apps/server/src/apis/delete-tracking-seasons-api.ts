import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncTrackingCompletedTagByExternalId } from '../core/database/repositories/collection';
import { deleteTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { deleteCompletedEpisodesByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { resolveTrackingSeriesTarget } from '../core/utils/tracking-series-target-util';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const db = getDatabase();
    const query = (request.query ?? {}) as Record<string, unknown>;
    const target = resolveTrackingSeriesTarget(
      db,
      request.usernameHash,
      query.ownerShareCode,
      externalIdentitySource,
      externalIdentityId,
      'update'
    );
    if (target.status !== 200) return response.code(target.status).send();
    const targetExternalItemId = target.item.external_item_id ?? externalIdentityId;

    deleteTrackingSeasonsByExternalId(db, target.ownerHash, target.item.external_provider, targetExternalItemId);
    deleteCompletedEpisodesByExternalId(db, target.ownerHash, target.item.external_provider, targetExternalItemId);
    const item = syncTrackingCompletedTagByExternalId(
      db,
      target.ownerHash,
      target.item.external_provider,
      targetExternalItemId
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
