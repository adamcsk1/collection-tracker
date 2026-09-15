import { ExternalMetadataProviderReplacementConfig } from '@node/models/external-metadata-config-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';

export type ExternalMetadataConfig = Partial<
  Record<ExternalMetadataProviderNameModel, ExternalMetadataProviderReplacementConfig>
>;
