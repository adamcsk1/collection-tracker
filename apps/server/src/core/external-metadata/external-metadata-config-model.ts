export interface ExternalMetadataProviderHeaderConfig {
  name: string;
  value: string;
}

export interface ExternalMetadataProviderReplacementConfig {
  baseUrl: string;
  header?: ExternalMetadataProviderHeaderConfig;
}
