import {
  CollectionListTypeModel,
  WatchingSeasonMetadataModel,
  WatchingWatchedEpisodeModel,
} from '@shared/models/api-model';

export const isWatchingCompleted = (
  listType: CollectionListTypeModel,
  seasons: WatchingSeasonMetadataModel[],
  watchedEpisodes: WatchingWatchedEpisodeModel[]
): boolean => {
  if (listType !== 'watching') return false;
  if (!seasons.length) return false;
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodes, 0);
  return totalEpisodes > 0 && watchedEpisodes.length === totalEpisodes;
};

export const formatWatchingEpisode = (episode: WatchingWatchedEpisodeModel | null): string | null => {
  if (!episode) return null;
  return `S${`${episode.season}`.padStart(2, '0')}E${`${episode.episode}`.padStart(2, '0')}`;
};
