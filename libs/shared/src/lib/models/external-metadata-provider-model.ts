export const EXTERNAL_METADATA_PROVIDER_NAMES = ['omdb', 'openlibrary', 'musicbrainz'] as const;
export type ExternalMetadataProviderNameModel = (typeof EXTERNAL_METADATA_PROVIDER_NAMES)[number];
export type ExternalItemIdentitySourceNameModel = ExternalMetadataProviderNameModel | 'imdb' | 'isbn';
export type ExternalItemIdentitySourceConfidenceModel = 'primary' | 'alias';

export interface ExternalItemIdentityModel {
  source: ExternalItemIdentitySourceNameModel;
  id: string;
}
