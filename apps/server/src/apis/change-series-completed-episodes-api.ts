import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import {
  TrackingCompletedEpisodesApiRequestModel,
  TrackingCompletedEpisodesApiResponseModel,
  TrackingCompletedEpisodeModel,
} from '@shared/models/api-model';
import { MAX_SERIES_EPISODES, MAX_SERIES_SEASONS } from '@shared/constants/tracking-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { syncTrackingCompletedTagByExternalId } from '../core/database/repositories/collection';
import { findTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { replaceCompletedEpisodesByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { resolveTrackingSeriesTarget } from '../core/utils/tracking-series-target-util';

const normalizeCompletedEpisodes = (
  body: TrackingCompletedEpisodesApiRequestModel
): TrackingCompletedEpisodeModel[] | null => {
  if (!Array.isArray(body?.completedEpisodes)) return null;

  const seenEpisodes = new Set<string>();
  const episodes: TrackingCompletedEpisodeModel[] = [];
  for (const episodeData of body.completedEpisodes) {
    const season = Number(episodeData?.season);
    const episode = Number(episodeData?.episode);
    if (
      !Number.isInteger(season) ||
      season < 1 ||
      season > MAX_SERIES_SEASONS ||
      !Number.isInteger(episode) ||
      episode < 1 ||
      episode > MAX_SERIES_EPISODES
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
  episodes: TrackingCompletedEpisodeModel[],
  seasons: ReturnType<typeof findTrackingSeasonsByExternalId>
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
    const query = (request.query ?? {}) as Record<string, unknown>;
    const target = resolveTrackingSeriesTarget(
      db,
      request.usernameHash,
      query.ownerShareCode,
      externalIdentitySource,
      externalIdentityId,
      'update'
    );
    if (target.status !== 200) return response.code(target.status).send();
    const targetExternalItemId = target.item.external_item_id ?? externalIdentityId;

    const episodes = normalizeCompletedEpisodes(request.body as TrackingCompletedEpisodesApiRequestModel);
    if (!episodes) return response.code(400).send();

    const seasons = findTrackingSeasonsByExternalId(
      db,
      target.ownerHash,
      target.item.external_provider,
      targetExternalItemId
    );
    if (!episodesExistInSeasons(episodes, seasons)) return response.code(400).send();

    const savedEpisodes = replaceCompletedEpisodesByExternalId(
      db,
      target.ownerHash,
      target.item.external_provider,
      targetExternalItemId,
      episodes
    );
    const item = syncTrackingCompletedTagByExternalId(
      db,
      target.ownerHash,
      target.item.external_provider,
      targetExternalItemId
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
    `${API_PREFIX}/tracking/:externalIdentitySource/:externalIdentityId/completed-episodes`,
    { preHandler: jwtGuard },
    handler
  );
};
