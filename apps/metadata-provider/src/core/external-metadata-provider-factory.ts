import { ExternalMetadataProvider } from '@node/models/external-metadata-runtime-model';
import { createNormalizedHttpExternalMetadataProvider } from '@node/utils/normalized-http-provider';
import { getExternalMetadataConfig } from './external-metadata-config';
import { DEFAULT_OMDB_API_URL } from '../providers/omdb-const';
import { OmdbExternalMetadataProvider } from '../providers/omdb-provider';
import { DEFAULT_MUSICBRAINZ_API_URL, DEFAULT_COVER_ART_ARCHIVE_URL } from '../providers/musicbrainz-const';
import { MusicBrainzExternalMetadataProvider } from '../providers/musicbrainz-provider';
import { DEFAULT_OPENLIBRARY_API_URL } from '../providers/openlibrary-const';
import { OpenLibraryExternalMetadataProvider } from '../providers/openlibrary-provider';

export const getExternalMetadataProviderByName = (providerName: string): ExternalMetadataProvider | null => {
  return getExternalMetadataProviders().find((provider) => provider.name === providerName) ?? null;
};

export const getExternalMetadataProviders = (): ExternalMetadataProvider[] => {
  const replacements = getExternalMetadataConfig();
  const omdbApiKey = process.env.OMDB_API_KEY?.trim();
  const omdbApiUrl = process.env.OMDB_API_URL?.trim() || DEFAULT_OMDB_API_URL;
  const openLibraryApiUrl = process.env.OPENLIBRARY_API_URL?.trim() || DEFAULT_OPENLIBRARY_API_URL;
  const musicBrainzApiUrl = process.env.MUSICBRAINZ_API_URL?.trim() || DEFAULT_MUSICBRAINZ_API_URL;
  const coverArtArchiveUrl = process.env.COVERARTARCHIVE_API_URL?.trim() || DEFAULT_COVER_ART_ARCHIVE_URL;
  return [
    ...(replacements.omdb
      ? [createNormalizedHttpExternalMetadataProvider('omdb', replacements.omdb)]
      : omdbApiKey
        ? [new OmdbExternalMetadataProvider(omdbApiKey, omdbApiUrl)]
        : []),
    replacements.openlibrary
      ? createNormalizedHttpExternalMetadataProvider('openlibrary', replacements.openlibrary)
      : new OpenLibraryExternalMetadataProvider(openLibraryApiUrl),
    replacements.musicbrainz
      ? createNormalizedHttpExternalMetadataProvider('musicbrainz', replacements.musicbrainz)
      : new MusicBrainzExternalMetadataProvider(musicBrainzApiUrl, coverArtArchiveUrl),
  ];
};
