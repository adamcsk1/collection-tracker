import type { CollectionItemApiModel } from './collection-api-model';
import type { TrackingCompletedEpisodeModel, TrackingSeasonMetadataModel } from './tracking-api-model';
import type { TagManagementApiResponseModel, UserSettingsApiResponseModel } from './user-api-model';

export interface UserExportApiResponseModel {
  type: string;
  version: number;
  userSettings: UserSettingsApiResponseModel;
  collectionItems: CollectionItemApiModel[];
  tagManagement: TagManagementApiResponseModel;
  trackingData: Record<
    string,
    {
      seasons: TrackingSeasonMetadataModel[];
      completedEpisodes: TrackingCompletedEpisodeModel[];
    }
  >;
}

export type UserImportApiRequestModel = UserExportApiResponseModel;

export interface UserImportApiResponseModel {
  importedCollectionItems: number;
  importedTagManagement: number;
  importedTrackingSeasons: number;
  importedTrackingCompletedEpisodes: number;
}

export interface CollectionItemsImportApiRequestModel {
  source: string;
}

export interface CollectionItemsImportApiResponseModel {
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
}
