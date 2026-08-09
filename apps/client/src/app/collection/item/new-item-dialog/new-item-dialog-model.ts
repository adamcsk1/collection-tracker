import { CollectionListTypeModel } from '@shared/models/api-model';

export type NewItemMode = 'search' | 'manual';

export interface NewItemSearchModel {
  searchText: string;
  selectedExternalReference: string | null;
  userRate: number | null;
  tags: string;
  finished: boolean;
  copyToTrackingAsCompleted: boolean;
  targetOwnerShareCode: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
}

export type SaveMode = 'new' | 'close' | null;

export interface SaveOptions {
  targetOwnerShareCode?: string;
  listType?: CollectionListTypeModel;
  finished?: boolean;
  copyToTrackingAsCompleted?: boolean;
  progressCurrent?: number | null;
  progressTotal?: number | null;
}
