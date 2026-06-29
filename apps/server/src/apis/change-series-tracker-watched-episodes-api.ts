import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import {
  SeriesTrackerWatchedEpisodesApiRequestModel,
  SeriesTrackerWatchedEpisodesApiResponseModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncSeriesTrackerCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { findSeriesTrackerSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { replaceWatchedEpisodesByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const normalizeWatchedEpisodes = (
  body: SeriesTrackerWatchedEpisodesApiRequestModel
): SeriesTrackerWatchedEpisodeModel[] | null => {
  if (!Array.isArray(body?.watchedEpisodes)) return null;

  const seenEpisodes = new Set<string>();
  const episodes: SeriesTrackerWatchedEpisodeModel[] = [];
  for (const episodeData of body.watchedEpisodes) {
    const season = Number(episodeData?.season);
    const episode = Number(episodeData?.episode);
    if (
      !Number.isInteger(season) ||
      season < 1 ||
      season > MAX_SERIES_TRACKER_SEASONS ||
      !Number.isInteger(episode) ||
      episode < 1 ||
      episode > MAX_SERIES_TRACKER_EPISODES
    )
      return null;
    const key = `${season}-${episode}`;
    if (seenEpisodes.has(key)) return null;
    seenEpisodes.add(key);

    episodes.push({ season, episode });
  }

  return episodes.sort((firstEpisode, secondEpisode) => {
    if (firstEpisode.season !== secondEpisode.season) {
      return firstEpisode.season - secondEpisode.season;
    }
    return firstEpisode.episode - secondEpisode.episode;
  });
};

const episodesExistInSeasons = (
  episodes: SeriesTrackerWatchedEpisodeModel[],
  seasons: ReturnType<typeof findSeriesTrackerSeasonsByExternalId>
): boolean => {
  if (!episodes.length) return true;

  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  return episodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
};

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/series-tracker/:externalIdentitySource/:externalIdentityId/watched-episodes`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
      const db = getDatabase();
      if (
        !findCollectionItemByExternalIdOrCanonicalItemId(
          db,
          request.usernameHash,
          externalIdentitySource,
          externalIdentityId,
          'series-tracker'
        )
      ) {
        return response.code(404).send();
      }

      const episodes = normalizeWatchedEpisodes(request.body as SeriesTrackerWatchedEpisodesApiRequestModel);
      if (!episodes) return response.code(400).send();

      const seasons = findSeriesTrackerSeasonsByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId
      );
      if (!episodesExistInSeasons(episodes, seasons)) return response.code(400).send();

      const savedEpisodes = replaceWatchedEpisodesByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId,
        episodes
      );
      const item = syncSeriesTrackerCompletedTagByExternalId(
        db,
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId
      );
      const result: SeriesTrackerWatchedEpisodesApiResponseModel = {
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
    })
  );
};
