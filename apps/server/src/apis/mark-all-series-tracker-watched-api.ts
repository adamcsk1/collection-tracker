import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchingWatchedEpisodesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncWatchingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import {
  findWatchingSeasonsByExternalId,
  replaceWatchingSeasonsByExternalId,
} from '../core/database/repositories/series-tracker-season-repository';
import { markAllEpisodesWatchedByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
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
      'watching'
    );
    if (!trackerItem) {
      return response.code(404).send();
    }
    const trackerExternalProvider = trackerItem.external_provider;
    const trackerExternalItemId = trackerItem.external_item_id ?? trackerItem.imdb_id ?? externalIdentityId;

    let seasons = findWatchingSeasonsByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId
    );
    if (!seasons.length) {
      const fetchedSeasons = await fetchSeriesSeasonMetadata(trackerExternalProvider, trackerExternalItemId);
      if (fetchedSeasons.length) {
        seasons = replaceWatchingSeasonsByExternalId(
          db,
          request.usernameHash,
          trackerExternalProvider,
          trackerExternalItemId,
          fetchedSeasons
        );
      }
    }
    if (!seasons.length) return response.code(400).send();

    const savedEpisodes = markAllEpisodesWatchedByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId,
      seasons
    );
    const item = syncWatchingCompletedTagByExternalId(
      db,
      request.usernameHash,
      trackerExternalProvider,
      trackerExternalItemId
    );
    const result: WatchingWatchedEpisodesApiResponseModel = {
      watchedEpisodes: savedEpisodes,
      lastWatchedEpisode: savedEpisodes.length
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
    `${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId/mark-all-watched`,
    { preHandler: jwtGuard },
    handler
  );
};
