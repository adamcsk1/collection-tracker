import type {
  ExternalItemIdentitySourceNameModel,
  ExternalMetadataProviderNameModel,
} from '../models/external-metadata-provider-model';
import { EXTERNAL_METADATA_PROVIDER_NAMES } from '../models/external-metadata-provider-model';

export const isExternalMetadataProviderName = (provider: string): provider is ExternalMetadataProviderNameModel =>
  (EXTERNAL_METADATA_PROVIDER_NAMES as readonly string[]).includes(provider);

export const isExternalItemIdentitySourceName = (source: string): source is ExternalItemIdentitySourceNameModel =>
  isExternalMetadataProviderName(source) || source === 'imdb' || source === 'isbn';
