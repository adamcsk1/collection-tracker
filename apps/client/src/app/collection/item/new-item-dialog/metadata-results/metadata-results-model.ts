import { ExternalMetadataSelectDataModel } from '@shared/models/external-metadata-model';

export interface MetadataResultOptionModel extends ExternalMetadataSelectDataModel {
  disabled?: boolean;
  hint?: string;
}
