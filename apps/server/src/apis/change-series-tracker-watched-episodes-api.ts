import { API_PREFIX } from '@shared/constants/api-const';
import {
  SeriesTrackerWatchedEpisodesApiRequestModel,
  SeriesTrackerWatchedEpisodesApiResponseModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncSeriesTrackerCompletedTag } from '../core/database/repositories/collection';
import { findSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { replaceWatchedEpisodes } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { hasOwnSeriesTrackerItem } from '../core/utils/series-tracker-seasons-api-util';

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
  seasons: ReturnType<typeof findSeriesTrackerSeasons>
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
    `${API_PREFIX}/series-tracker/:imdbId/watched-episodes`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { imdbId } = request.params as Record<string, string>;
      if (!hasOwnSeriesTrackerItem(request.usernameHash, imdbId)) return response.code(404).send();

      const episodes = normalizeWatchedEpisodes(request.body as SeriesTrackerWatchedEpisodesApiRequestModel);
      if (!episodes) return response.code(400).send();

      const db = getDatabase();
      const seasons = findSeriesTrackerSeasons(db, request.usernameHash, imdbId);
      if (!episodesExistInSeasons(episodes, seasons)) return response.code(400).send();

      const savedEpisodes = replaceWatchedEpisodes(db, request.usernameHash, imdbId, episodes);
      const item = syncSeriesTrackerCompletedTag(db, request.usernameHash, imdbId);
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
