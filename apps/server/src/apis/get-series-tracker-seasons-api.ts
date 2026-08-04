import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByExternalIdOrCanonicalItemId } from '../core/database/repositories/collection';
import { findWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
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
        'watching'
      )
    ) {
      return response.code(404).send();
    }

    const seasons = findWatchingSeasonsByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const result: WatchingSeasonsApiResponseModel = { seasons };
    response.send(result);
  });

  app.get(
    `${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId/seasons`,
    { preHandler: jwtGuard },
    handler
  );
};
