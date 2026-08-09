import type { CollectionItemApiModel } from './collection-api-model';

export interface MarkAllCompletedApiResponseModel {
  changedCount: number;
}

export interface MarkAllSeriesCompletedApiResponseModel {
  trackedCount: number;
  progressChangedCount: number;
}

export interface MarkAllUncompletedApiResponseModel {
  changedCount: number;
}

export interface CompletedApiResponseModel {
  item: CollectionItemApiModel;
}

export type FinishedApiResponseModel = CompletedApiResponseModel;

export interface TrackingApiResponseModel {
  item: CollectionItemApiModel;
}

export interface TrackingSeasonMetadataModel {
  season: number;
  episodes: number;
  titles?: string[];
}

export interface TrackingSeasonsApiResponseModel {
  seasons: TrackingSeasonMetadataModel[];
  item?: CollectionItemApiModel;
}

export interface TrackingSeasonsApiRequestModel {
  seasons: TrackingSeasonMetadataModel[];
}

export interface TrackingCompletedEpisodeModel {
  season: number;
  episode: number;
}

export interface TrackingCompletedEpisodesApiResponseModel {
  completedEpisodes: TrackingCompletedEpisodeModel[];
  lastCompletedEpisode: { season: number; episode: number } | null;
  item?: CollectionItemApiModel;
}

export interface TrackingCompletedEpisodesApiRequestModel {
  completedEpisodes: TrackingCompletedEpisodeModel[];
}
