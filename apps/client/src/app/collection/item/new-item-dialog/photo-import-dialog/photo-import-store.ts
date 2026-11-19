import { createInjectionToken } from 'ngx-simple-signal-store';
import { PhotoImportAvailabilityResponseModel } from '@shared/models/photo-import-model';
import { PhotoImportPhotoModel, PhotoImportRowModel } from './photo-import-model';

export interface PhotoImportState {
  photos: PhotoImportPhotoModel[];
  rows: PhotoImportRowModel[];
  busy: boolean;
  stopRequested: boolean;
  invalidPhotos: boolean;
  availability: PhotoImportAvailabilityResponseModel | null;
}

export const initialPhotoImportState: PhotoImportState = {
  photos: [],
  rows: [],
  busy: false,
  stopRequested: false,
  invalidPhotos: false,
  availability: null,
};
export const photoImportStateToken = createInjectionToken<PhotoImportState>('photoImportState');
