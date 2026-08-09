import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncTrackingCompletedTagByExternalId } from '../core/database/repositories/collection';
import { replaceTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { deleteCompletedEpisodesOutsideSeasonsByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { resolveTrackingSeriesTarget } from '../core/utils/tracking-series-target-util';
import { jwtGuard } from '../core/jwt';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';

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
    const trackerItem = target.item;

    const trackerExternalItemId = trackerItem.external_item_id ?? trackerItem.imdb_id;
    if (!trackerExternalItemId) return response.code(404).send();

    const seasons = await fetchSeriesSeasonMetadata(trackerItem.external_provider, trackerExternalItemId);
    const savedSeasons = replaceTrackingSeasonsByExternalId(
      db,
      target.ownerHash,
      trackerItem.external_provider,
      trackerExternalItemId,
      seasons
    );
    deleteCompletedEpisodesOutsideSeasonsByExternalId(
      db,
      target.ownerHash,
      trackerItem.external_provider,
      trackerExternalItemId,
      savedSeasons
    );
    const item = syncTrackingCompletedTagByExternalId(
      db,
      target.ownerHash,
      trackerItem.external_provider,
      trackerExternalItemId
    );
    const result: TrackingSeasonsApiResponseModel = { seasons: savedSeasons, item };
    response.send(result);
  });

  app.post(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/seasons/refresh`,
    { preHandler: jwtGuard },
    handler
  );
};
