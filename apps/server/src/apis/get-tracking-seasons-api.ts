import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
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
      'read'
    );
    if (target.status !== 200) return response.code(target.status).send();

    const seasons = findTrackingSeasonsByExternalId(
      db,
      target.ownerHash,
      target.item.external_provider,
      target.item.external_item_id ?? externalIdentityId
    );
    const result: TrackingSeasonsApiResponseModel = { seasons };
    response.send(result);
  });

  app.get(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/seasons`,
    { preHandler: jwtGuard },
    handler
  );
};
