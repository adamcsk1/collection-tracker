import { ExternalMetadataProvider } from './external-metadata-provider';
import { OmdbExternalMetadataProvider } from './providers/omdb-provider';

export const getExternalMetadataProviderByName = (providerName: string): ExternalMetadataProvider | null => {
  return getExternalMetadataProviders().find((provider) => provider.name === providerName) ?? null;
};

export const getExternalMetadataProviders = (): ExternalMetadataProvider[] => {
  const omdbApiKey = process.env.OMDB_API_KEY?.trim();
  return omdbApiKey ? [new OmdbExternalMetadataProvider(omdbApiKey)] : [];
};

export const getDirectImdbExternalMetadataProvider = (): ExternalMetadataProvider | null =>
  getExternalMetadataProviders().find(
    (provider) => provider.supportsDirectImdbId === true && typeof provider.getItemByImdbId === 'function'
  ) ?? null;
