import type {
  ExternalItemIdentitySourceNameModel,
  ExternalMetadataProviderNameModel,
} from '../models/external-metadata-provider-model';

export const DEFAULT_EXTERNAL_METADATA_PROVIDER: ExternalMetadataProviderNameModel = 'omdb';

export const isExternalMetadataProviderName = (provider: string): provider is ExternalMetadataProviderNameModel =>
  provider === DEFAULT_EXTERNAL_METADATA_PROVIDER;

export const isExternalItemIdentitySourceName = (source: string): source is ExternalItemIdentitySourceNameModel =>
  source === DEFAULT_EXTERNAL_METADATA_PROVIDER || source === 'imdb';
