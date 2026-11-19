import { CollectionItemContentTypeModel } from './collection-item-model';

export type PhotoImportAvailabilityReasonModel =
  'available' | 'not-configured' | 'invalid-config' | 'unreachable' | 'unsupported-model';

export interface PhotoImportAvailabilityResponseModel {
  available: boolean;
  reason: PhotoImportAvailabilityReasonModel;
}

export interface PhotoImportRecognizeRequestModel {
  contentType: CollectionItemContentTypeModel;
  imageBase64: string;
}

export interface PhotoImportRecognizedTitleModel {
  title: string;
  year: string | null;
  contributor: string | null;
}

export interface PhotoImportRecognizeResponseModel {
  titles: PhotoImportRecognizedTitleModel[];
}
