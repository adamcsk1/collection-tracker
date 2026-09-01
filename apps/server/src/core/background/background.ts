import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { resolveImdbId } from '@shared/utils/imdb-id-util';
import { getArgv } from '../argv/argv';
import { getDirectImdbExternalMetadataProvider } from '../external-metadata/external-metadata-provider-factory';
import { fetchAndCacheImage, getCachedImage } from '../image/image-proxy';
import { debugLog } from '../logger';
import {
  BACKGROUND_CONFIG_FILE_NAME,
  DEFAULT_BACKGROUND_IMDB_IDS,
  MAX_BACKGROUND_IMAGE_COUNT,
} from './background-const';

let cachedImdbIds: string[] = [...DEFAULT_BACKGROUND_IMDB_IDS];
let cachedMtimeMs = 0;
let hasConfigFile = false;
let posterUrls: string[] = [];
let warmedConfigKey = '';
let warmPromise: Promise<void> | null = null;

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const normalizeImdbIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [...DEFAULT_BACKGROUND_IMDB_IDS];

  const ids: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const imdbId = resolveImdbId(value);
    if (!imdbId || ids.includes(imdbId)) continue;
    ids.push(imdbId);
    if (ids.length >= MAX_BACKGROUND_IMAGE_COUNT) break;
  }

  return ids;
};

const readBackgroundImdbIds = (): string[] => {
  const configPath = join(getArgv().dataFolder, BACKGROUND_CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    cachedImdbIds = [...DEFAULT_BACKGROUND_IMDB_IDS];
    cachedMtimeMs = 0;
    hasConfigFile = false;
    return cachedImdbIds;
  }

  const { mtimeMs } = statSync(configPath);
  if (hasConfigFile && mtimeMs <= cachedMtimeMs) return cachedImdbIds;

  try {
    const config = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' })) as { imdbIds?: unknown };
    cachedImdbIds = normalizeImdbIds(config.imdbIds);
    cachedMtimeMs = mtimeMs;
    hasConfigFile = true;
    return cachedImdbIds;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(`Background config at ${configPath} is invalid (${message}). Using default IMDb IDs.`);
    cachedImdbIds = [...DEFAULT_BACKGROUND_IMDB_IDS];
    cachedMtimeMs = mtimeMs;
    hasConfigFile = true;
    return cachedImdbIds;
  }
};

const runWarm = async (): Promise<void> => {
  const provider = getDirectImdbExternalMetadataProvider();
  if (!provider?.getItemByImdbId) {
    posterUrls = [];
    await debugLog('Background image warmup skipped (no IMDb metadata provider).');
    return;
  }

  const urls: string[] = [];
  for (const imdbId of readBackgroundImdbIds()) {
    try {
      const item = await provider.getItemByImdbId(imdbId);
      const poster = item?.poster?.trim() ?? '';
      if (!poster || poster.toUpperCase() === 'N/A' || !isHttpUrl(poster)) continue;
      if (!(await getCachedImage(poster)) && !(await fetchAndCacheImage(poster))) continue;
      urls.push(poster);
      posterUrls = urls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await debugLog(`Background image warmup skipped ${imdbId} (${message}).`);
    }
  }

  posterUrls = urls;
};

export const getBackgroundImdbIds = (): string[] => readBackgroundImdbIds();

export const isBackgroundImageUrl = (sourceUrl: string): boolean => posterUrls.includes(sourceUrl);

export const getCachedBackgroundImageUrls = async (): Promise<string[]> => {
  const cached: string[] = [];
  for (const sourceUrl of posterUrls) {
    if (await getCachedImage(sourceUrl)) cached.push(sourceUrl);
  }
  return cached;
};

const getConfigKey = (): string => (hasConfigFile ? `${cachedMtimeMs}` : 'defaults');

export const warmBackgroundImages = (): Promise<void> => {
  readBackgroundImdbIds();
  const configKey = getConfigKey();
  if (warmPromise) return warmPromise;
  if (warmedConfigKey === configKey) return Promise.resolve();

  warmPromise = runWarm().finally(() => {
    warmedConfigKey = configKey;
    warmPromise = null;
  });
  return warmPromise;
};
