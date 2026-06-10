import { SeriesTrackerSeasonsApiRequestModel, SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { getDatabase } from '../database/database';
import { findCollectionItemByImdbId } from '../database/repositories/collection';

export const normalizeSeriesTrackerSeasons = (
  body: SeriesTrackerSeasonsApiRequestModel
): SeriesTrackerSeasonMetadataModel[] | null => {
  if (!Array.isArray(body?.seasons)) return null;

  const seenSeasons = new Set<number>();
  const seasons: SeriesTrackerSeasonMetadataModel[] = [];
  for (const seasonMetadata of body.seasons) {
    const season = Number(seasonMetadata?.season);
    const episodes = Number(seasonMetadata?.episodes);
    if (
      !Number.isInteger(season) ||
      season < 1 ||
      season > MAX_SERIES_TRACKER_SEASONS ||
      !Number.isInteger(episodes) ||
      episodes < 1 ||
      episodes > MAX_SERIES_TRACKER_EPISODES
    )
      return null;
    if (seenSeasons.has(season)) return null;
    seenSeasons.add(season);

    const rawTitles = seasonMetadata?.titles;
    let titles: string[] | undefined;
    if (Array.isArray(rawTitles)) {
      if (!rawTitles.every((title) => typeof title === 'string')) return null;
      titles = rawTitles.slice(0, MAX_SERIES_TRACKER_EPISODES);
    }

    seasons.push({ season, episodes, titles });
  }

  return seasons.sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
};

export const hasOwnSeriesTrackerItem = (usernameHash: string, imdbId: string): boolean =>
  !!findCollectionItemByImdbId(getDatabase(), usernameHash, imdbId, 'series-tracker');
