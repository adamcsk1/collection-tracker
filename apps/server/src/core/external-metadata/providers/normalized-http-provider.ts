import { MAX_SERIES_EPISODES, MAX_SERIES_SEASONS } from '@shared/constants/tracking-const';
import { TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { CollectionItemContentTypeModel } from '@shared/models/collection-item-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { resolveImdbId } from '@shared/utils/imdb-id-util';
import { normalizeIsbn13 } from '@shared/utils/isbn-util';
import { normalizeMbid } from '@shared/utils/mbid-util';
import { ExternalMetadataProvider, ExternalMetadataSeasonProvider } from '../external-metadata-provider';
import { ExternalMetadataProviderReplacementConfig } from '../external-metadata-config-model';
import {
  NORMALIZED_PROVIDER_MAX_ACTORS_LENGTH,
  NORMALIZED_PROVIDER_MAX_EPISODE_TITLE_LENGTH,
  NORMALIZED_PROVIDER_MAX_EXTERNAL_IDS,
  NORMALIZED_PROVIDER_MAX_GENRE_LENGTH,
  NORMALIZED_PROVIDER_MAX_GENRES,
  NORMALIZED_PROVIDER_MAX_ID_LENGTH,
  NORMALIZED_PROVIDER_MAX_PLOT_LENGTH,
  NORMALIZED_PROVIDER_MAX_POSTER_LENGTH,
  NORMALIZED_PROVIDER_MAX_RATING_LENGTH,
  NORMALIZED_PROVIDER_MAX_RATINGS,
  NORMALIZED_PROVIDER_MAX_RESPONSE_BYTES,
  NORMALIZED_PROVIDER_MAX_SEARCH_RESULTS,
  NORMALIZED_PROVIDER_MAX_TITLE_LENGTH,
  NORMALIZED_PROVIDER_MAX_YEAR_LENGTH,
  NORMALIZED_PROVIDER_REQUEST_TIMEOUT_MS,
} from './normalized-http-provider-const';

const CONTENT_TYPES_BY_PROVIDER: Record<ExternalMetadataProviderNameModel, CollectionItemContentTypeModel[]> = {
  omdb: ['movie', 'series'],
  openlibrary: ['book'],
  musicbrainz: ['album'],
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (value: unknown, field: string, maxLength: number, allowEmpty = true): string => {
  if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value.trim())) {
    throw new Error(`Normalized external metadata response has invalid ${field}`);
  }
  return value;
};

const normalizeSlotId = (providerName: ExternalMetadataProviderNameModel, value: string): string | null => {
  if (providerName === 'omdb') return resolveImdbId(value) || null;
  if (providerName === 'openlibrary') return normalizeIsbn13(value);
  return normalizeMbid(value);
};

const toRequestId = (providerName: ExternalMetadataProviderNameModel, value: string): string | null => {
  const normalized = normalizeSlotId(providerName, value);
  if (normalized) return normalized;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.length > NORMALIZED_PROVIDER_MAX_ID_LENGTH) {
    return null;
  }
  return /^[A-Za-z0-9._~-]+$/.test(trimmed) ? trimmed : null;
};

const toResponseSlotId = (providerName: ExternalMetadataProviderNameModel, value: string): string | null => {
  const normalized = normalizeSlotId(providerName, value);
  if (normalized) return normalized;
  if (providerName === 'omdb' && /^tt[A-Za-z0-9-]+$/i.test(value.trim())) return value.trim().toLowerCase();
  return null;
};

const normalizeIdentityId = (source: string, value: string): string | null => {
  if (source === 'imdb' || source === 'omdb') return resolveImdbId(value) || null;
  if (source === 'isbn' || source === 'openlibrary') return normalizeIsbn13(value);
  return normalizeMbid(value);
};

const getPoster = (value: unknown): string => {
  const poster = getString(value, 'poster', NORMALIZED_PROVIDER_MAX_POSTER_LENGTH);
  if (!poster) return poster;
  try {
    if (['http:', 'https:'].includes(new URL(poster).protocol)) return poster;
  } catch {
    // Fall through to the normalized response error.
  }
  throw new Error('Normalized external metadata response has invalid poster');
};

const readResponseText = async (response: Response, providerName: string): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    byteLength += value.byteLength;
    if (byteLength > NORMALIZED_PROVIDER_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(`${providerName} replacement response is too large`);
    }
    text += decoder.decode(value, { stream: true });
  }
};

export const createNormalizedHttpExternalMetadataProvider = (
  name: ExternalMetadataProviderNameModel,
  config: ExternalMetadataProviderReplacementConfig
): ExternalMetadataProvider => {
  const headers = new Headers({ Accept: 'application/json' });
  if (config.header) headers.set(config.header.name, config.header.value);

  const fetchData = async (
    path: string,
    searchParams?: Record<string, string>,
    allowNotFound = false
  ): Promise<unknown | null> => {
    const url = new URL(path, config.baseUrl);
    const base = new URL(config.baseUrl);
    if (url.origin !== base.origin || url.pathname !== `${base.pathname}${path}`) {
      throw new Error(`${name} replacement request path is invalid`);
    }
    for (const [key, value] of Object.entries(searchParams ?? {})) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(NORMALIZED_PROVIDER_REQUEST_TIMEOUT_MS),
    });
    const cancelBody = async (): Promise<void> => {
      await response.body?.cancel().catch(() => undefined);
    };
    if (allowNotFound && response.status === 404) {
      await cancelBody();
      return null;
    }
    if (!response.ok) {
      await cancelBody();
      throw new Error(`${name} replacement responded with ${response.status}`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      await cancelBody();
      throw new Error(`${name} replacement did not return JSON`);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > NORMALIZED_PROVIDER_MAX_RESPONSE_BYTES) {
      await cancelBody();
      throw new Error(`${name} replacement response is too large`);
    }
    const responseText = await readResponseText(response, name);
    const body: unknown = JSON.parse(responseText);
    if (!isObject(body) || !('data' in body)) throw new Error(`${name} replacement returned an invalid envelope`);
    return body.data;
  };

  const toItem = (value: unknown): ExternalMetadataItemModel => {
    if (!isObject(value)) throw new Error(`${name} replacement returned an invalid item`);
    const contentType = value.contentType;
    if (!CONTENT_TYPES_BY_PROVIDER[name].includes(contentType as CollectionItemContentTypeModel)) {
      throw new Error(`${name} replacement returned an unsupported content type`);
    }
    if (!Array.isArray(value.genres) || value.genres.length > NORMALIZED_PROVIDER_MAX_GENRES) {
      throw new Error(`${name} replacement returned invalid genres`);
    }
    if (!Array.isArray(value.ratings) || value.ratings.length > NORMALIZED_PROVIDER_MAX_RATINGS) {
      throw new Error(`${name} replacement returned invalid ratings`);
    }

    const externalIds = value.externalIds;
    if (
      externalIds !== undefined &&
      (!Array.isArray(externalIds) || externalIds.length > NORMALIZED_PROVIDER_MAX_EXTERNAL_IDS)
    ) {
      throw new Error(`${name} replacement returned invalid external IDs`);
    }

    const providerItemId = toResponseSlotId(
      name,
      getString(value.providerItemId, 'providerItemId', NORMALIZED_PROVIDER_MAX_ID_LENGTH, false)
    );
    if (!providerItemId) throw new Error(`${name} replacement returned an invalid providerItemId`);

    return {
      provider: name,
      providerItemId,
      ...(externalIds === undefined
        ? {}
        : {
            externalIds: externalIds.map((externalId) => {
              if (
                !isObject(externalId) ||
                typeof externalId.source !== 'string' ||
                !isExternalItemIdentitySourceName(externalId.source)
              ) {
                throw new Error(`${name} replacement returned an invalid external ID`);
              }
              const id = normalizeIdentityId(
                externalId.source,
                getString(externalId.id, 'externalIds.id', NORMALIZED_PROVIDER_MAX_ID_LENGTH, false)
              );
              if (!id) throw new Error(`${name} replacement returned an invalid external ID`);
              return { source: externalId.source, id };
            }),
          }),
      title: getString(value.title, 'title', NORMALIZED_PROVIDER_MAX_TITLE_LENGTH, false),
      year: getString(value.year, 'year', NORMALIZED_PROVIDER_MAX_YEAR_LENGTH),
      contentType: contentType as CollectionItemContentTypeModel,
      poster: getPoster(value.poster),
      plot: getString(value.plot, 'plot', NORMALIZED_PROVIDER_MAX_PLOT_LENGTH),
      actors: getString(value.actors, 'actors', NORMALIZED_PROVIDER_MAX_ACTORS_LENGTH),
      genres: value.genres.map((genre) => getString(genre, 'genre', NORMALIZED_PROVIDER_MAX_GENRE_LENGTH, false)),
      ratings: value.ratings.map((rating) => {
        if (!isObject(rating)) throw new Error(`${name} replacement returned an invalid rating`);
        return {
          source: getString(rating.source, 'ratings.source', NORMALIZED_PROVIDER_MAX_RATING_LENGTH, false),
          value: getString(rating.value, 'ratings.value', NORMALIZED_PROVIDER_MAX_RATING_LENGTH, false),
        };
      }),
    };
  };

  const getItem = async (providerItemId: string): Promise<ExternalMetadataItemModel | null> => {
    const requestId = toRequestId(name, providerItemId);
    if (!requestId) return null;
    const data = await fetchData(`items/${encodeURIComponent(requestId)}`, undefined, true);
    return data === null ? null : toItem(data);
  };

  const provider: ExternalMetadataProvider = {
    name,
    search: async (searchText) => {
      const data = await fetchData('search', { s: searchText });
      if (
        !isObject(data) ||
        !Array.isArray(data.results) ||
        data.results.length > NORMALIZED_PROVIDER_MAX_SEARCH_RESULTS
      ) {
        throw new Error(`${name} replacement returned invalid search results`);
      }
      return { results: data.results.map(toItem) };
    },
    getItem,
  };

  if (name !== 'omdb') return provider;
  const omdbProvider: ExternalMetadataSeasonProvider = {
    ...provider,
    supportsDirectImdbId: true,
    getItemByImdbId: async (imdbId) => {
      const requestId = toRequestId(name, imdbId);
      if (!requestId) return null;
      const data = await fetchData(`items/by-imdb/${encodeURIComponent(requestId)}`, undefined, true);
      return data === null ? null : toItem(data);
    },
    getSeriesSeasons: async (providerItemId: string): Promise<TrackingSeasonMetadataModel[]> => {
      const requestId = toRequestId(name, providerItemId);
      if (!requestId) throw new Error(`${name} replacement request path is invalid`);
      const data = await fetchData(`items/${encodeURIComponent(requestId)}/seasons`);
      if (!isObject(data) || !Array.isArray(data.seasons) || data.seasons.length > MAX_SERIES_SEASONS) {
        throw new Error(`${name} replacement returned invalid season metadata`);
      }
      const seenSeasons = new Set<number>();
      return data.seasons.map((value) => {
        if (!isObject(value) || !Number.isInteger(value.season) || !Number.isInteger(value.episodes)) {
          throw new Error(`${name} replacement returned invalid season metadata`);
        }
        const season = value.season as number;
        const episodes = value.episodes as number;
        if (season < 1 || season > MAX_SERIES_SEASONS || episodes < 1 || episodes > MAX_SERIES_EPISODES) {
          throw new Error(`${name} replacement returned invalid season metadata`);
        }
        if (seenSeasons.has(season)) throw new Error(`${name} replacement returned duplicate season metadata`);
        seenSeasons.add(season);
        if (value.titles !== undefined && (!Array.isArray(value.titles) || value.titles.length > episodes)) {
          throw new Error(`${name} replacement returned invalid episode titles`);
        }
        return {
          season,
          episodes,
          ...(value.titles === undefined
            ? {}
            : {
                titles: value.titles.map((title) =>
                  getString(title, 'season title', NORMALIZED_PROVIDER_MAX_EPISODE_TITLE_LENGTH)
                ),
              }),
        };
      });
    },
  };
  return omdbProvider;
};
