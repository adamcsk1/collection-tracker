import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import {
  WatchingWatchedEpisodesApiRequestModel,
  WatchingWatchedEpisodesApiResponseModel,
  WatchingWatchedEpisodeModel,
} from '@shared/models/api-model';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByExternalIdOrCanonicalItemId,
  syncWatchingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import { findWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { replaceWatchedEpisodesByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const normalizeWatchedEpisodes = (
  body: WatchingWatchedEpisodesApiRequestModel
): WatchingWatchedEpisodeModel[] | null => {
  if (!Array.isArray(body?.watchedEpisodes)) return null;

  const seenEpisodes = new Set<string>();
  const episodes: WatchingWatchedEpisodeModel[] = [];
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
  episodes: WatchingWatchedEpisodeModel[],
  seasons: ReturnType<typeof findWatchingSeasonsByExternalId>
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

    const episodes = normalizeWatchedEpisodes(request.body as WatchingWatchedEpisodesApiRequestModel);
    if (!episodes) return response.code(400).send();

    const seasons = findWatchingSeasonsByExternalId(
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
    const item = syncWatchingCompletedTagByExternalId(
      db,
      request.usernameHash,
      externalIdentitySource,
      externalIdentityId
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
    `${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId/watched-episodes`,
    { preHandler: jwtGuard },
    handler
  );
};
