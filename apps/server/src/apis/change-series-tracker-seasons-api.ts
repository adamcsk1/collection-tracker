import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchingSeasonsApiRequestModel, WatchingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncWatchingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { replaceWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { deleteWatchedEpisodesOutsideSeasonsByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { normalizeWatchingSeasons } from '../core/utils/series-tracker-seasons-api-util';

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

    const seasons = normalizeWatchingSeasons(request.body as WatchingSeasonsApiRequestModel);
    if (!seasons) return response.code(400).send();

    const savedSeasons = replaceWatchingSeasonsByExternalId(
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
    const item = syncWatchingCompletedTagByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
    );
    const result: WatchingSeasonsApiResponseModel = { seasons: savedSeasons, item };
    response.send(result);
  });

  app.put(
    `${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId/seasons`,
    { preHandler: jwtGuard },
    handler
  );
};
