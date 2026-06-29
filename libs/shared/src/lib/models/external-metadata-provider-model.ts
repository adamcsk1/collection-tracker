export type ExternalMetadataProviderNameModel = 'omdb';
export type ExternalItemIdentitySourceNameModel = ExternalMetadataProviderNameModel | 'imdb';
export type ExternalItemIdentitySourceConfidenceModel = 'fallback' | 'provider';

export interface ExternalItemIdentityModel {
  source: ExternalItemIdentitySourceNameModel;
  id: string;
}
