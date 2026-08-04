import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchingSeasonsApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncWatchingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { replaceWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { deleteWatchedEpisodesOutsideSeasonsByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const db = getDatabase();
    const trackerItem = findCollectionItemByExternalIdOrCanonicalItemId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId,
      'watching'
    );
    if (!trackerItem) return response.code(404).send();

    const trackerExternalItemId = trackerItem.external_item_id ?? trackerItem.imdb_id;
    if (!trackerExternalItemId) return response.code(404).send();

    const seasons = await fetchSeriesSeasonMetadata(trackerItem.external_provider, trackerExternalItemId);
    const savedSeasons = replaceWatchingSeasonsByExternalId(
      db,
      request.usernameHash,
      trackerItem.external_provider,
      trackerExternalItemId,
      seasons
    );
    deleteWatchedEpisodesOutsideSeasonsByExternalId(
      db,
      request.usernameHash,
      trackerItem.external_provider,
      trackerExternalItemId,
      savedSeasons
    );
    const item = syncWatchingCompletedTagByExternalId(
      db,
      request.usernameHash,
      trackerItem.external_provider,
      trackerExternalItemId
    );
    const result: WatchingSeasonsApiResponseModel = { seasons: savedSeasons, item };
    response.send(result);
  });

  app.post(
    `${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId/seasons/refresh`,
    { preHandler: jwtGuard },
    handler
  );
};
