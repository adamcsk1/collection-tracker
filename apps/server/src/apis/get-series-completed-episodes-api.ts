import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { TrackingCompletedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemByExternalIdOrCanonicalItemId } from '../core/database/repositories/collection';
import {
  findCompletedEpisodesByExternalId,
  findLastCompletedEpisodeByExternalId,
} from '../core/database/repositories/series-completed-episodes-repository';
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

    const completedEpisodes = findCompletedEpisodesByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const lastCompletedEpisode = findLastCompletedEpisodeByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const result: TrackingCompletedEpisodesApiResponseModel = { completedEpisodes, lastCompletedEpisode };
    response.send(result);
  });

  app.get(
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/completed-episodes`,
    { preHandler: jwtGuard },
    handler
  );
};
