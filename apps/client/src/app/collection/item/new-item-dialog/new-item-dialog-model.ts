import { CollectionListTypeModel } from '@shared/models/api-model';

export interface NewItemModel {
  searchText: string;
  selectedExternalReference: string | null;
  userRate: number | null;
  tags: string;
  watched: boolean;
  copyToSeriesTrackerAsWatched: boolean;
  targetOwnerShareCode: string | null;
}

export type SaveMode = 'new' | 'close' | null;

export interface SaveOptions {
  targetOwnerShareCode?: string;
  listType?: CollectionListTypeModel;
  watched?: boolean;
  copyToSeriesTrackerAsWatched?: boolean;
}
