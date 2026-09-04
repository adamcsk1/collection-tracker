import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';

export interface ExternalMetadataProviderHeaderConfig {
  name: string;
  value: string;
}

export interface ExternalMetadataProviderReplacementConfig {
  baseUrl: string;
  header?: ExternalMetadataProviderHeaderConfig;
}

export type ExternalMetadataConfig = Partial<
  Record<ExternalMetadataProviderNameModel, ExternalMetadataProviderReplacementConfig>
>;
