import {
  CollectionListTypeModel,
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';

export const isSeriesTrackerCompleted = (
  listType: CollectionListTypeModel,
  seasons: SeriesTrackerSeasonMetadataModel[],
  watchedEpisodes: SeriesTrackerWatchedEpisodeModel[]
): boolean => {
  if (listType !== 'series-tracker') return false;
  if (!seasons.length) return false;
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodes, 0);
  return totalEpisodes > 0 && watchedEpisodes.length === totalEpisodes;
};

export const formatSeriesTrackerEpisode = (episode: SeriesTrackerWatchedEpisodeModel | null): string | null => {
  if (!episode) return null;
  return `S${`${episode.season}`.padStart(2, '0')}E${`${episode.episode}`.padStart(2, '0')}`;
};
