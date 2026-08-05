import {
  CollectionListTypeModel,
  TrackingSeasonMetadataModel,
  TrackingCompletedEpisodeModel,
} from '@shared/models/api-model';

export const isTrackingCompleted = (
  listType: CollectionListTypeModel,
  seasons: TrackingSeasonMetadataModel[],
  completedEpisodes: TrackingCompletedEpisodeModel[]
): boolean => {
  if (listType !== 'tracking') return false;
  if (!seasons.length) return false;
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodes, 0);
  return totalEpisodes > 0 && completedEpisodes.length === totalEpisodes;
};

export const formatTrackingEpisode = (episode: TrackingCompletedEpisodeModel | null): string | null => {
  if (!episode) return null;
  return `S${`${episode.season}`.padStart(2, '0')}E${`${episode.episode}`.padStart(2, '0')}`;
};
