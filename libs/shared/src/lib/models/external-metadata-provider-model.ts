export const EXTERNAL_METADATA_PROVIDER_NAMES = ['omdb'] as const;
export type ExternalMetadataProviderNameModel = (typeof EXTERNAL_METADATA_PROVIDER_NAMES)[number];
export type ExternalItemIdentitySourceNameModel = ExternalMetadataProviderNameModel | 'imdb';
export type ExternalItemIdentitySourceConfidenceModel = 'primary' | 'alias';

export interface ExternalItemIdentityModel {
  source: ExternalItemIdentitySourceNameModel;
  id: string;
}
