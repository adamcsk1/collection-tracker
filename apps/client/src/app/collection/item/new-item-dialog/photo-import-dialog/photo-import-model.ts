import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';

export interface PhotoImportDetailsModel {
  tags: string;
  userRate: number | null;
}

export interface PhotoImportPhotoModel {
  id: string;
  file: File;
  preview: string;
  status: 'ready' | 'reading' | 'recognized' | 'error';
}

export interface PhotoImportRowModel {
  id: string;
  photoId: string;
  title: string;
  identifier?: string;
  photoName: string;
  details: string;
  matches: ExternalMetadataItemModel[];
  selected: ExternalMetadataItemModel | null;
  status: 'ready' | 'searching' | 'error' | 'adding' | 'added' | 'exists' | 'skipped';
  searched: boolean;
  finished?: boolean;
  copyToTrackingAsCompleted?: boolean;
  trackerUpdateFailed?: boolean;
}
