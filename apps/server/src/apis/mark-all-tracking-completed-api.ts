import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingCompletedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncTrackingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import {
  findTrackingSeasonsByExternalId,
  replaceTrackingSeasonsByExternalId,
} from '../core/database/repositories/tracking-season-repository';
import { markAllEpisodesCompletedByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { jwtGuard } from '../core/jwt';
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
      'tracking'
    );
    if (!trackerItem) {
      return response.code(404).send();
    }
    const trackerExternalProvider = trackerItem.external_provider;
    const trackerExternalItemId = trackerItem.external_item_id ?? trackerItem.imdb_id ?? externalIdentityId;

    let seasons = findTrackingSeasonsByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId
    );
    if (!seasons.length) {
      const fetchedSeasons = await fetchSeriesSeasonMetadata(trackerExternalProvider, trackerExternalItemId);
      if (fetchedSeasons.length) {
        seasons = replaceTrackingSeasonsByExternalId(
          db,
          request.usernameHash,
          trackerExternalProvider,
          trackerExternalItemId,
          fetchedSeasons
        );
      }
    }
    if (!seasons.length) return response.code(400).send();

    const savedEpisodes = markAllEpisodesCompletedByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId,
      seasons
    );
    const item = syncTrackingCompletedTagByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId
    );
    const result: TrackingCompletedEpisodesApiResponseModel = {
      completedEpisodes: savedEpisodes,
      lastCompletedEpisode: savedEpisodes.length
        ? {
            season: savedEpisodes[savedEpisodes.length - 1].season,
            episode: savedEpisodes[savedEpisodes.length - 1].episode,
          }
        : null,
      item,
    };
    response.send(result);
  });

  app.put(
    `${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/tracking/actions/mark-completed`,
    { preHandler: jwtGuard },
    handler
  );
};
