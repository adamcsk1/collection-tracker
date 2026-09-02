import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveImdbId } from '@shared/utils/imdb-id-util';
import { normalizeIsbn13 } from '@shared/utils/isbn-util';
import { normalizeMbid } from '@shared/utils/mbid-util';
import { getArgv } from '../argv/argv';
import { getDirectImdbExternalMetadataProvider } from '../external-metadata/external-metadata-provider-factory';
import { DEFAULT_COVER_ART_ARCHIVE_URL } from '../external-metadata/providers/musicbrainz-const';
import { DEFAULT_OPENLIBRARY_COVER_URL } from '../external-metadata/providers/openlibrary-const';
import { fetchAndCacheImage, getCachedImage } from '../image/image-proxy';
import { debugLog } from '../logger';
import {
  BACKGROUND_CONFIG_FILE_NAME,
  DEFAULT_BACKGROUND_IMDB_IDS,
  MAX_BACKGROUND_IMAGE_COUNT,
} from './background-const';
import { BackgroundConfig, BackgroundIdentity } from './background-model';

let identities: BackgroundIdentity[] = DEFAULT_BACKGROUND_IMDB_IDS.map((id) => ({ kind: 'imdb', id }));
let posters: Record<string, string> = {};
let parsedConfig: BackgroundConfig = { imdbIds: [...DEFAULT_BACKGROUND_IMDB_IDS] };
let cachedMtimeMs = 0;
let hasConfigFile = false;
let canWritePosters = false;
let posterUrls: string[] = [];
let warmedConfigKey = '';
let warmPromise: Promise<void> | null = null;

const getConfigPath = (): string => join(getArgv().dataFolder, BACKGROUND_CONFIG_FILE_NAME);

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const getCoverArtArchiveUrl = (): string => {
  const coverUrl = process.env.COVERARTARCHIVE_API_URL?.trim() || DEFAULT_COVER_ART_ARCHIVE_URL;
  const normalized = new URL(coverUrl);
  normalized.pathname = `${normalized.pathname.replace(/\/$/, '')}/`;
  return normalized.href;
};

const getOpenLibraryCoverUrl = (isbn: string): string => {
  const url = new URL(`b/isbn/${isbn}-L.jpg`, DEFAULT_OPENLIBRARY_COVER_URL);
  url.searchParams.set('default', 'false');
  return url.href;
};

const getMusicBrainzCoverUrl = (mbid: string): string => new URL(`release/${mbid}/front-500`, getCoverArtArchiveUrl()).href;

const addIdentities = (
  values: unknown,
  kind: BackgroundIdentity['kind'],
  normalize: (value: string) => string | null,
  next: BackgroundIdentity[]
): void => {
  if (!Array.isArray(values) || next.length >= MAX_BACKGROUND_IMAGE_COUNT) return;
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const id = normalize(value);
    if (!id || next.some((identity) => identity.id === id)) continue;
    next.push({ kind, id });
    if (next.length >= MAX_BACKGROUND_IMAGE_COUNT) break;
  }
};

const normalizePosters = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [id, poster] of Object.entries(value)) {
    if (typeof poster !== 'string' || !isHttpUrl(poster.trim())) continue;
    next[id] = poster.trim();
  }
  return next;
};

const readBackgroundConfig = (): void => {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    identities = DEFAULT_BACKGROUND_IMDB_IDS.map((id) => ({ kind: 'imdb', id }));
    posters = {};
    parsedConfig = { imdbIds: [...DEFAULT_BACKGROUND_IMDB_IDS] };
    cachedMtimeMs = 0;
    hasConfigFile = false;
    canWritePosters = false;
    return;
  }

  const { mtimeMs } = statSync(configPath);
  if (hasConfigFile && mtimeMs <= cachedMtimeMs) return;

  try {
    const config = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' })) as BackgroundConfig;
    const next: BackgroundIdentity[] = [];
    if (Array.isArray(config.imdbIds)) {
      addIdentities(config.imdbIds, 'imdb', (value) => resolveImdbId(value) || null, next);
    } else {
      addIdentities([...DEFAULT_BACKGROUND_IMDB_IDS], 'imdb', (value) => value, next);
    }
    addIdentities(config.isbnIds, 'isbn', normalizeIsbn13, next);
    addIdentities(config.mbids, 'mbid', normalizeMbid, next);
    identities = next;
    posters = normalizePosters(config.posters);
    parsedConfig = config;
    cachedMtimeMs = mtimeMs;
    hasConfigFile = true;
    canWritePosters = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(`Background config at ${configPath} is invalid (${message}). Using default IMDb IDs.`);
    identities = DEFAULT_BACKGROUND_IMDB_IDS.map((id) => ({ kind: 'imdb', id }));
    posters = {};
    parsedConfig = { imdbIds: [...DEFAULT_BACKGROUND_IMDB_IDS] };
    cachedMtimeMs = mtimeMs;
    hasConfigFile = true;
    canWritePosters = false;
  }
};

const writePosters = (nextPosters: Record<string, string>): void => {
  if (!canWritePosters) return;
  const configPath = getConfigPath();
  try {
    const nextConfig = { ...parsedConfig, posters: nextPosters };
    writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, { encoding: 'utf-8' });
    parsedConfig = nextConfig;
    posters = nextPosters;
    cachedMtimeMs = statSync(configPath).mtimeMs;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(`Background config at ${configPath} could not be updated (${message}).`);
  }
};

const resolvePoster = async (identity: BackgroundIdentity): Promise<string> => {
  if (identity.kind === 'isbn') return getOpenLibraryCoverUrl(identity.id);
  if (identity.kind === 'mbid') return getMusicBrainzCoverUrl(identity.id);

  const provider = getDirectImdbExternalMetadataProvider();
  if (!provider?.getItemByImdbId) return '';
  const item = await provider.getItemByImdbId(identity.id);
  const poster = item?.poster?.trim() ?? '';
  if (!poster || poster.toUpperCase() === 'N/A' || !isHttpUrl(poster)) return '';
  return poster;
};

const runWarm = async (): Promise<void> => {
  const urls: string[] = [];
  const nextPosters = { ...posters };
  let postersChanged = false;
  const activeIds = new Set(identities.map((identity) => identity.id));

  for (const identity of identities) {
    try {
      let poster = nextPosters[identity.id] ?? '';
      if (!poster) {
        poster = await resolvePoster(identity);
        if (!poster) continue;
        nextPosters[identity.id] = poster;
        postersChanged = true;
      }
      if (!(await getCachedImage(poster)) && !(await fetchAndCacheImage(poster))) continue;
      urls.push(poster);
      posterUrls = urls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await debugLog(`Background image warmup skipped ${identity.id} (${message}).`);
    }
  }

  for (const id of Object.keys(nextPosters)) {
    if (activeIds.has(id)) continue;
    delete nextPosters[id];
    postersChanged = true;
  }

  posterUrls = urls;
  if (postersChanged) writePosters(nextPosters);
};

export const getBackgroundImdbIds = (): string[] => {
  readBackgroundConfig();
  return identities.filter((identity) => identity.kind === 'imdb').map((identity) => identity.id);
};

export const isBackgroundImageUrl = (sourceUrl: string): boolean => posterUrls.includes(sourceUrl);

export const getCachedBackgroundImageUrls = async (): Promise<string[]> => {
  const cached: string[] = [];
  for (const sourceUrl of posterUrls) {
    if (await getCachedImage(sourceUrl)) cached.push(sourceUrl);
  }
  return cached;
};

const getConfigKey = (): string => identities.map((identity) => `${identity.kind}:${identity.id}`).join(',');

export const warmBackgroundImages = (): Promise<void> => {
  readBackgroundConfig();
  const configKey = getConfigKey();
  if (warmPromise) return warmPromise;
  if (warmedConfigKey === configKey) return Promise.resolve();

  warmPromise = runWarm().finally(() => {
    warmedConfigKey = configKey;
    warmPromise = null;
  });
  return warmPromise;
};
