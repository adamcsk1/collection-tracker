import { ExternalMetadataProvider } from './external-metadata-provider';
import { DEFAULT_OMDB_API_URL } from './providers/omdb-const';
import { OmdbExternalMetadataProvider } from './providers/omdb-provider';
import { DEFAULT_OPENLIBRARY_API_URL } from './providers/openlibrary-const';
import { OpenLibraryExternalMetadataProvider } from './providers/openlibrary-provider';

export const getExternalMetadataProviderByName = (providerName: string): ExternalMetadataProvider | null => {
  return getExternalMetadataProviders().find((provider) => provider.name === providerName) ?? null;
};

export const getExternalMetadataProviders = (): ExternalMetadataProvider[] => {
  const omdbApiKey = process.env.OMDB_API_KEY?.trim();
  const omdbApiUrl = process.env.OMDB_API_URL?.trim() || DEFAULT_OMDB_API_URL;
  const openLibraryApiUrl = process.env.OPENLIBRARY_API_URL?.trim() || DEFAULT_OPENLIBRARY_API_URL;
  return [
    ...(omdbApiKey ? [new OmdbExternalMetadataProvider(omdbApiKey, omdbApiUrl)] : []),
    new OpenLibraryExternalMetadataProvider(openLibraryApiUrl),
  ];
};

export const getDirectImdbExternalMetadataProvider = (): ExternalMetadataProvider | null =>
  getExternalMetadataProviders().find(
    (provider) => provider.supportsDirectImdbId === true && typeof provider.getItemByImdbId === 'function'
  ) ?? null;
