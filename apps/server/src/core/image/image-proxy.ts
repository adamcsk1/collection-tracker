import { createHash, randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { type ClientRequest, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { isIP } from 'net';
import { basename, dirname, extname, join } from 'path';
import sharp from 'sharp';
import { PROXY_IMAGE_VARIANTS, type ProxyImageVariant } from '@shared/utils/proxy-image-url-util';
import { getArgv } from '../argv/argv';
import { FOLDERS } from '../main-const';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from './image-cache-file';
import {
  CONTENT_TYPE_EXTENSIONS,
  FETCH_TIMEOUT_MS,
  IMAGE_CACHE_ENTRY_OVERHEAD_BYTES,
  IMAGE_CACHE_MAX_BYTES,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_VARIANT_CONTENT_TYPE,
  IMAGE_CACHE_VARIANT_MAX_WIDTH,
  IMAGE_VARIANT_MAX_INPUT_PIXELS,
  IMAGE_PROXY_CONCURRENCY,
  IMAGE_PROXY_QUEUE_MAX,
  IMAGE_PROXY_QUEUE_TIMEOUT_MS,
  IMAGE_VARIANT_CONCURRENCY,
  MAX_IMAGE_BYTES,
  MAX_REDIRECT_HOPS,
} from './image-proxy-const';
import {
  CachedImage,
  ImageCacheEntry,
  ImageCacheMetadata,
  ImageCacheState,
  ImageFetchQueueEntry,
  ImageProxyResult,
  ProxiedImageResponse,
  PublicTarget,
} from './image-proxy-model';

const getImageCacheFolder = async (): Promise<string> => {
  const folder = join(getArgv().dataFolder, FOLDERS.cache);
  await mkdir(folder, { recursive: true });
  return folder;
};

const getCacheKey = (url: string): string => createHash('sha256').update(url).digest('hex');

const inFlightRequests = new Map<string, Promise<ImageProxyResult>>();
const cacheStates = new Map<string, Promise<ImageCacheState>>();
const fetchQueue: ImageFetchQueueEntry[] = [];
let activeFetches = 0;
const variantJobs = new Map<string, Promise<void>>();
const variantWaiters: Array<() => void> = [];
let activeVariantJobs = 0;

const getVariantFileName = (cacheKey: string, variant: ProxyImageVariant): string => `${cacheKey}.${variant}.webp`;

const getCacheKeyFromMetadataPath = (metadataPath: string): string => basename(metadataPath, '.json');

const acquireVariantSlot = async (): Promise<void> => {
  if (activeVariantJobs < IMAGE_VARIANT_CONCURRENCY) {
    activeVariantJobs += 1;
    return;
  }

  await new Promise<void>((resolve) => variantWaiters.push(resolve));
};

const releaseVariantSlot = (): void => {
  const next = variantWaiters.shift();
  if (next) next();
  else activeVariantJobs -= 1;
};

const acquireFetchSlot = async (): Promise<boolean> => {
  if (activeFetches < IMAGE_PROXY_CONCURRENCY) {
    activeFetches += 1;
    return true;
  }

  if (fetchQueue.length >= IMAGE_PROXY_QUEUE_MAX) return false;

  return new Promise<boolean>((resolve) => {
    const entry: ImageFetchQueueEntry = {
      grant: () => {
        clearTimeout(entry.timeout);
        resolve(true);
      },
      timeout: setTimeout(() => {
        const queueIndex = fetchQueue.indexOf(entry);
        if (queueIndex >= 0) fetchQueue.splice(queueIndex, 1);
        resolve(false);
      }, IMAGE_PROXY_QUEUE_TIMEOUT_MS),
    };
    fetchQueue.push(entry);
  });
};

const releaseFetchSlot = (): void => {
  const next = fetchQueue.shift();
  if (next) next.grant();
  else activeFetches -= 1;
};

const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost');
};

const getUnbracketedHostname = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

const isBlockedIp = (address: string): boolean => {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split('.').map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) return isBlockedIp(normalized.slice(7));

    const hextets = normalized.split(':').filter(Boolean);
    const firstHextet = hextets[0] ?? '';
    const firstValue = Number.parseInt(firstHextet || '0', 16);
    const isUniqueLocal = (firstValue & 0xfe00) === 0xfc00;
    const isLinkLocal = (firstValue & 0xffc0) === 0xfe80;
    const isMulticast = (firstValue & 0xff00) === 0xff00;

    return normalized === '::' || normalized === '::1' || isUniqueLocal || isLinkLocal || isMulticast;
  }

  return true;
};

const waitForOperation = <Result>(operation: Promise<Result>, signal: AbortSignal): Promise<Result> =>
  new Promise((resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (result) => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });

const getPublicTarget = async (url: URL, signal: AbortSignal): Promise<PublicTarget | null> => {
  if (signal.aborted) throw signal.reason;
  if (isBlockedHostname(url.hostname)) return null;

  const lookupHostname = getUnbracketedHostname(url.hostname);
  const directIp = isIP(lookupHostname);
  if (directIp === 4 || directIp === 6) {
    return isBlockedIp(lookupHostname) ? null : { address: lookupHostname, family: directIp };
  }

  const addresses = await waitForOperation(lookup(lookupHostname, { all: true, verbatim: false }), signal);
  const publicAddresses = addresses.filter(({ address }) => !isBlockedIp(address));
  if (!publicAddresses.length || publicAddresses.length !== addresses.length) return null;

  return publicAddresses[0] as PublicTarget;
};

const readImageBytes = async (
  stream: NodeJS.ReadableStream & { destroy: (error?: Error) => void },
  contentLength: number
): Promise<Buffer | null> => {
  if (contentLength > MAX_IMAGE_BYTES) {
    stream.destroy();
    return null;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      stream.destroy();
      return null;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
};

const fetchImage = (url: URL, target: PublicTarget, signal: AbortSignal): Promise<ProxiedImageResponse> => {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const requestHostname = getUnbracketedHostname(url.hostname);

  return new Promise((resolve, reject) => {
    let settled = false;
    let activeResponse: (NodeJS.ReadableStream & { destroy: (error?: Error) => void }) | undefined;
    let clientRequest: ClientRequest | undefined;
    const abort = (): void => {
      const error = signal.reason instanceof Error ? signal.reason : new Error('Image proxy request timed out');
      activeResponse?.destroy(error);
      clientRequest?.destroy(error);
      rejectOnce(error);
    };
    const resolveOnce = (response: ProxiedImageResponse): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      resolve(response);
    };
    const rejectOnce = (error: unknown): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      reject(error);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    clientRequest = request(
      {
        protocol: url.protocol,
        hostname: target.address,
        family: target.family,
        ...(isIP(requestHostname) === 0 ? { servername: requestHostname } : {}),
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { Host: url.host, 'User-Agent': 'CollectionTracker/1.0' },
      },
      async (proxiedResponse) => {
        activeResponse = proxiedResponse;
        try {
          const statusCode = proxiedResponse.statusCode ?? 502;
          const contentType = String(proxiedResponse.headers['content-type'] ?? 'application/octet-stream');
          const contentLength = Number(proxiedResponse.headers['content-length'] ?? 0);
          const locationHeader = proxiedResponse.headers.location;
          const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

          if (statusCode >= 300 && statusCode < 400) {
            proxiedResponse.destroy();
            resolveOnce({
              statusCode,
              contentType,
              image: null,
              location: typeof location === 'string' ? location : undefined,
            });
            return;
          }

          resolveOnce({ statusCode, contentType, image: await readImageBytes(proxiedResponse, contentLength) });
        } catch (error) {
          rejectOnce(error);
        }
      }
    );

    clientRequest.on('error', rejectOnce);
    clientRequest.end();
  });
};

const getExtension = (url: URL, contentType: string): string => {
  const contentTypeExtension = CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0].toLowerCase()];
  if (contentTypeExtension) return contentTypeExtension;

  const urlExtension = extname(url.pathname).toLowerCase();
  return urlExtension && urlExtension.length <= 6 ? urlExtension : '.img';
};

const readMetadata = async (path: string): Promise<ImageCacheMetadata | null> => {
  try {
    const metadata: unknown = JSON.parse(await readFile(path, 'utf-8'));
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      !('contentType' in metadata) ||
      typeof metadata.contentType !== 'string' ||
      !('fileName' in metadata) ||
      typeof metadata.fileName !== 'string' ||
      !('sourceUrl' in metadata) ||
      typeof metadata.sourceUrl !== 'string'
    ) {
      return null;
    }

    const accessedAt =
      'accessedAt' in metadata && typeof metadata.accessedAt === 'number' && Number.isFinite(metadata.accessedAt)
        ? metadata.accessedAt
        : Number.NaN;
    const size =
      'size' in metadata && typeof metadata.size === 'number' && Number.isFinite(metadata.size) ? metadata.size : 0;

    return {
      accessedAt,
      contentType: metadata.contentType,
      fileName: metadata.fileName,
      size,
      sourceUrl: metadata.sourceUrl,
    };
  } catch {
    return null;
  }
};

const runCacheMutation = async <Result>(
  cacheState: ImageCacheState,
  mutation: () => Promise<Result>
): Promise<Result> => {
  const operation = cacheState.mutation.then(mutation, mutation);
  cacheState.mutation = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
};

const runEntryFileMutation = <Result>(
  cacheState: ImageCacheState,
  metadataPath: string,
  mutation: () => Promise<Result>
): Promise<Result> => {
  const previousOperation = cacheState.fileMutations.get(metadataPath) ?? Promise.resolve();
  const operation = previousOperation.then(mutation, mutation);
  const completedOperation = operation.then(
    () => undefined,
    () => undefined
  );
  cacheState.fileMutations.set(metadataPath, completedOperation);
  void completedOperation.then(() => {
    if (cacheState.fileMutations.get(metadataPath) === completedOperation) {
      cacheState.fileMutations.delete(metadataPath);
    }
  });
  return operation;
};

const removeCacheEntry = (cacheState: ImageCacheState, entry: ImageCacheEntry): Promise<void> => {
  cacheState.entries.delete(entry.metadataPath);
  if (cacheState.entriesBySourceUrl.get(entry.metadata.sourceUrl) === entry) {
    cacheState.entriesBySourceUrl.delete(entry.metadata.sourceUrl);
  }
  cacheState.dirtyAccesses.delete(entry.metadataPath);
  cacheState.bytes -= entry.size;
  const cacheFolder = dirname(entry.metadataPath);
  const cacheKey = getCacheKeyFromMetadataPath(entry.metadataPath);
  return runEntryFileMutation(cacheState, entry.metadataPath, async () => {
    await Promise.all([
      rm(entry.imagePath, { force: true }),
      rm(entry.metadataPath, { force: true }),
      ...PROXY_IMAGE_VARIANTS.map((variant) =>
        rm(join(cacheFolder, getVariantFileName(cacheKey, variant)), { force: true })
      ),
    ]);
  });
};

const findLeastRecentlyUsedEntry = (cacheState: ImageCacheState): ImageCacheEntry | undefined => {
  let oldest: ImageCacheEntry | undefined;
  for (const entry of cacheState.entries.values()) {
    if (
      !oldest ||
      entry.metadata.accessedAt < oldest.metadata.accessedAt ||
      (entry.metadata.accessedAt === oldest.metadata.accessedAt && entry.metadataPath < oldest.metadataPath)
    ) {
      oldest = entry;
    }
  }
  return oldest;
};

const enforceCacheQuota = (cacheState: ImageCacheState, incomingBytes: number): Promise<void>[] => {
  const removals: Promise<void>[] = [];
  while (isImageCacheQuotaExceeded(cacheState.bytes, cacheState.entries.size, incomingBytes)) {
    const oldest = findLeastRecentlyUsedEntry(cacheState);
    if (!oldest) break;
    removals.push(removeCacheEntry(cacheState, oldest));
  }
  return removals;
};

const collectCacheQuotaTrims = (cacheState: ImageCacheState): Promise<void>[] => {
  const removals: Promise<void>[] = [];
  while (cacheState.bytes > IMAGE_CACHE_MAX_BYTES || cacheState.entries.size > IMAGE_CACHE_MAX_ENTRIES) {
    const oldest = findLeastRecentlyUsedEntry(cacheState);
    if (!oldest) break;
    removals.push(removeCacheEntry(cacheState, oldest));
  }
  return removals;
};

const trimCacheToQuota = async (cacheState: ImageCacheState): Promise<void> => {
  const removals = collectCacheQuotaTrims(cacheState);
  await Promise.all(removals);
};

const flushAccessMetadata = async (cacheState: ImageCacheState): Promise<void> => {
  const writes = await runCacheMutation(cacheState, async () => {
    const pendingWrites: Array<{ entry: ImageCacheEntry; metadataBytes: number; operation: Promise<void> }> = [];
    for (const metadataPath of cacheState.dirtyAccesses) {
      const entry = cacheState.entries.get(metadataPath);
      if (!entry) continue;

      const serializedMetadata = JSON.stringify(entry.metadata);
      pendingWrites.push({
        entry,
        metadataBytes: Buffer.byteLength(serializedMetadata),
        operation: runEntryFileMutation(cacheState, entry.metadataPath, async () => {
          const temporaryMetadataPath = `${entry.metadataPath}.${randomUUID()}.tmp`;
          try {
            await writeFile(temporaryMetadataPath, serializedMetadata);
            await rename(temporaryMetadataPath, entry.metadataPath);
          } finally {
            await rm(temporaryMetadataPath, { force: true });
          }
        }),
      });
    }
    cacheState.dirtyAccesses.clear();
    return pendingWrites;
  });
  await Promise.all(writes.map(({ operation }) => operation));
  const removals = await runCacheMutation(cacheState, async () => {
    for (const { entry, metadataBytes } of writes) {
      if (cacheState.entries.get(entry.metadataPath) !== entry) continue;
      const previousMetadataBytes = entry.metadataBytes;
      entry.metadataBytes = metadataBytes;
      entry.size += metadataBytes - previousMetadataBytes;
      cacheState.bytes += metadataBytes - previousMetadataBytes;
    }
    return collectCacheQuotaTrims(cacheState);
  });
  await Promise.all(removals);
};

const scheduleAccessMetadataFlush = (cacheState: ImageCacheState): void => {
  if (cacheState.accessFlushTimeout) return;
  cacheState.accessFlushTimeout = setTimeout(() => {
    cacheState.accessFlushTimeout = undefined;
    void flushAccessMetadata(cacheState).catch(() => undefined);
  }, 1_000);
  cacheState.accessFlushTimeout.unref();
};

const initializeCacheState = async (cacheFolder: string): Promise<ImageCacheState> => {
  const cacheState: ImageCacheState = {
    bytes: 0,
    dirtyAccesses: new Set(),
    entries: new Map(),
    entriesBySourceUrl: new Map(),
    fileMutations: new Map(),
    mutation: Promise.resolve(),
  };
  const directoryEntries = await readdir(cacheFolder, { withFileTypes: true });
  const fileNames = directoryEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const referencedImages = new Set<string>();
  const metadataFileNames = fileNames.filter((fileName) => fileName.endsWith('.json'));

  for (let index = 0; index < metadataFileNames.length; index += 32) {
    await Promise.all(
      metadataFileNames.slice(index, index + 32).map(async (metadataFileName) => {
        const metadataPath = join(cacheFolder, metadataFileName);
        const metadata = await readMetadata(metadataPath);
        if (!metadata || metadata.fileName !== metadata.fileName.split(/[\\/]/).pop()) {
          await rm(metadataPath, { force: true });
          return;
        }

        const imagePath = join(cacheFolder, metadata.fileName);
        try {
          const [imageStats, metadataStats] = await Promise.all([stat(imagePath), stat(metadataPath)]);
          if (imageStats.size === 0) {
            await Promise.all([rm(imagePath, { force: true }), rm(metadataPath, { force: true })]);
            return;
          }

          metadata.accessedAt = Number.isFinite(metadata.accessedAt) ? metadata.accessedAt : imageStats.mtimeMs;
          metadata.size = imageStats.size;
          const cacheKey = metadataFileName.slice(0, -'.json'.length);
          let variantBytes = 0;
          for (const variant of PROXY_IMAGE_VARIANTS) {
            const variantFileName = getVariantFileName(cacheKey, variant);
            referencedImages.add(variantFileName);
            try {
              variantBytes += (await stat(join(cacheFolder, variantFileName))).size;
            } catch {
              continue;
            }
          }
          const entry: ImageCacheEntry = {
            imagePath,
            metadata,
            metadataBytes: metadataStats.size,
            metadataPath,
            size: imageStats.size + metadataStats.size + variantBytes + IMAGE_CACHE_ENTRY_OVERHEAD_BYTES,
          };
          referencedImages.add(metadata.fileName);
          cacheState.entries.set(metadataPath, entry);
          cacheState.entriesBySourceUrl.set(metadata.sourceUrl, entry);
          cacheState.bytes += entry.size;
        } catch {
          await rm(metadataPath, { force: true });
        }
      })
    );
  }

  await Promise.all(
    fileNames
      .filter((fileName) => !fileName.endsWith('.json') && !referencedImages.has(fileName))
      .map((fileName) => rm(join(cacheFolder, fileName), { force: true }))
  );
  await trimCacheToQuota(cacheState);
  return cacheState;
};

const getCacheState = async (): Promise<{ cacheFolder: string; cacheState: ImageCacheState }> => {
  const cacheFolder = await getImageCacheFolder();
  let initialization = cacheStates.get(cacheFolder);
  if (!initialization) {
    initialization = initializeCacheState(cacheFolder);
    cacheStates.set(cacheFolder, initialization);
  }
  return { cacheFolder, cacheState: await initialization };
};

const getCachedImageEntry = (cacheState: ImageCacheState, sourceUrl: string): ImageCacheEntry | null => {
  const entry = cacheState.entriesBySourceUrl.get(sourceUrl);
  if (!entry) return null;
  entry.metadata.accessedAt = Date.now();
  cacheState.dirtyAccesses.add(entry.metadataPath);
  scheduleAccessMetadataFlush(cacheState);
  return entry;
};

const listMissingVariants = async (cacheFolder: string, cacheKey: string): Promise<ProxyImageVariant[]> => {
  const missing: ProxyImageVariant[] = [];
  for (const variant of PROXY_IMAGE_VARIANTS) {
    try {
      if ((await stat(join(cacheFolder, getVariantFileName(cacheKey, variant)))).size > 0) continue;
    } catch {
      missing.push(variant);
      continue;
    }
    missing.push(variant);
  }
  return missing;
};

const writeVariantFiles = async (
  cacheState: ImageCacheState,
  entry: ImageCacheEntry,
  cacheFolder: string,
  cacheKey: string,
  variants: Array<{ variant: ProxyImageVariant; buffer: Buffer }>
): Promise<void> => {
  const written: Array<{ path: string; bytes: number }> = [];
  try {
    await runEntryFileMutation(cacheState, entry.metadataPath, async () => {
      if (cacheState.entries.get(entry.metadataPath) !== entry) return;
      for (const { variant, buffer } of variants) {
        const variantPath = join(cacheFolder, getVariantFileName(cacheKey, variant));
        const temporaryPath = `${variantPath}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporaryPath, buffer);
          await rename(temporaryPath, variantPath);
          written.push({ path: variantPath, bytes: buffer.byteLength });
        } finally {
          await rm(temporaryPath, { force: true });
        }
      }
    });
  } catch (error) {
    await Promise.all(written.map(({ path }) => rm(path, { force: true })));
    throw error;
  }

  const removals = await runCacheMutation(cacheState, async () => {
    if (cacheState.entries.get(entry.metadataPath) !== entry) return [];
    const addedBytes = written.reduce((total, { bytes }) => total + bytes, 0);
    entry.size += addedBytes;
    cacheState.bytes += addedBytes;
    return collectCacheQuotaTrims(cacheState);
  });
  await Promise.all(removals);
};

const generateMissingVariants = async (sourceUrl: string): Promise<void> => {
  const { cacheFolder, cacheState } = await getCacheState();
  const entry = cacheState.entriesBySourceUrl.get(sourceUrl);
  if (!entry) return;

  const cacheKey = getCacheKey(sourceUrl);
  const missing = await listMissingVariants(cacheFolder, cacheKey);
  if (!missing.length) return;

  let original: Buffer;
  try {
    original = await runEntryFileMutation(cacheState, entry.metadataPath, () => readFile(entry.imagePath));
  } catch {
    return;
  }
  if (!original.byteLength) return;

  const generated: Array<{ variant: ProxyImageVariant; buffer: Buffer }> = [];
  for (const variant of missing) {
    try {
      generated.push({
        variant,
        buffer: await sharp(original, { limitInputPixels: IMAGE_VARIANT_MAX_INPUT_PIXELS })
          .autoOrient()
          .resize({ width: IMAGE_CACHE_VARIANT_MAX_WIDTH[variant], withoutEnlargement: true })
          .webp()
          .toBuffer(),
      });
    } catch {
      continue;
    }
  }
  if (!generated.length) return;
  await writeVariantFiles(cacheState, entry, cacheFolder, cacheKey, generated);
};

const queueMissingVariants = (sourceUrl: string): Promise<void> => {
  const existing = variantJobs.get(sourceUrl);
  if (existing) return existing;

  const job = (async () => {
    await acquireVariantSlot();
    try {
      await generateMissingVariants(sourceUrl);
    } catch {
      return;
    } finally {
      releaseVariantSlot();
    }
  })().finally(() => {
    if (variantJobs.get(sourceUrl) === job) variantJobs.delete(sourceUrl);
  });
  variantJobs.set(sourceUrl, job);
  return job;
};

export const backfillImageCacheVariants = async (): Promise<void> => {
  const { cacheState } = await getCacheState();
  await Promise.all([...cacheState.entriesBySourceUrl.keys()].map((sourceUrl) => queueMissingVariants(sourceUrl)));
};

export const isImageCacheQuotaExceeded = (
  cacheBytes: number,
  cacheEntryCount: number,
  incomingBytes: number
): boolean => cacheBytes + incomingBytes > IMAGE_CACHE_MAX_BYTES || cacheEntryCount + 1 > IMAGE_CACHE_MAX_ENTRIES;

const fetchAndCacheUncachedImage = async (url: URL): Promise<ImageProxyResult> => {
  if (!(await acquireFetchSlot())) return { kind: 'busy' };
  const operationAbortController = new AbortController();
  const deadline = setTimeout(
    () => operationAbortController.abort(new Error('Image proxy request timed out')),
    FETCH_TIMEOUT_MS
  );
  try {
    const { cacheFolder, cacheState } = await getCacheState();
    if (await runCacheMutation(cacheState, async () => Boolean(getCachedImageEntry(cacheState, url.href)))) {
      void queueMissingVariants(url.href);
      return { kind: 'cached' };
    }

    const target = await getPublicTarget(url, operationAbortController.signal);
    if (!target) {
      return { kind: 'blocked' };
    }

    const cacheKey = getCacheKey(url.href);
    const metadataPath = join(cacheFolder, `${cacheKey}.json`);

    let currentUrl = url;
    let currentTarget = target;
    let proxiedResponse = await fetchImage(currentUrl, currentTarget, operationAbortController.signal);
    for (let redirectHop = 0; proxiedResponse.statusCode >= 300 && proxiedResponse.statusCode < 400; redirectHop++) {
      if (redirectHop >= MAX_REDIRECT_HOPS || !proxiedResponse.location) {
        return { kind: 'redirect' };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(proxiedResponse.location, currentUrl);
      } catch {
        return { kind: 'redirect' };
      }

      if (!['http:', 'https:'].includes(nextUrl.protocol)) {
        return { kind: 'invalid-url' };
      }

      const nextTarget = await getPublicTarget(nextUrl, operationAbortController.signal);
      if (!nextTarget) {
        return { kind: 'blocked' };
      }

      currentUrl = nextUrl;
      currentTarget = nextTarget;
      proxiedResponse = await fetchImage(currentUrl, currentTarget, operationAbortController.signal);
    }

    if (proxiedResponse.statusCode < 200 || proxiedResponse.statusCode >= 300) {
      return { kind: 'upstream-error', statusCode: proxiedResponse.statusCode };
    }

    const contentType = proxiedResponse.contentType;
    const normalizedContentType = contentType.split(';')[0].toLowerCase();
    if (!CONTENT_TYPE_EXTENSIONS[normalizedContentType]) {
      return { kind: 'not-image' };
    }

    const image = proxiedResponse.image;
    if (!image) {
      return { kind: 'too-large' };
    }
    if (image.byteLength === 0) return { kind: 'not-image' };

    const fileName = `${cacheKey}${getExtension(url, contentType)}`;
    const metadata = {
      accessedAt: Date.now(),
      contentType,
      fileName,
      size: image.byteLength,
      sourceUrl: url.href,
    } satisfies ImageCacheMetadata;
    const serializedMetadata = JSON.stringify(metadata);
    const imagePath = join(cacheFolder, fileName);
    const temporarySuffix = randomUUID();
    const temporaryImagePath = `${imagePath}.${temporarySuffix}.tmp`;
    const temporaryMetadataPath = `${metadataPath}.${temporarySuffix}.tmp`;
    const metadataBytes = Buffer.byteLength(serializedMetadata);
    const entrySize = image.byteLength + metadataBytes + IMAGE_CACHE_ENTRY_OVERHEAD_BYTES;
    try {
      await Promise.all([writeFile(temporaryImagePath, image), writeFile(temporaryMetadataPath, serializedMetadata)]);
    } catch (error) {
      await Promise.all([rm(temporaryImagePath, { force: true }), rm(temporaryMetadataPath, { force: true })]);
      throw error;
    }
    try {
      const removals = await runCacheMutation(cacheState, async () => {
        if (cacheState.entriesBySourceUrl.has(url.href)) return [];
        const pendingRemovals = enforceCacheQuota(cacheState, entrySize);
        await runEntryFileMutation(cacheState, metadataPath, async () => {
          await rename(temporaryImagePath, imagePath);
          try {
            await rename(temporaryMetadataPath, metadataPath);
          } catch (error) {
            await rm(imagePath, { force: true });
            throw error;
          }
        });
        const entry: ImageCacheEntry = {
          imagePath,
          metadata,
          metadataBytes,
          metadataPath,
          size: entrySize,
        };
        cacheState.entries.set(metadataPath, entry);
        cacheState.entriesBySourceUrl.set(url.href, entry);
        cacheState.bytes += entrySize;
        return pendingRemovals;
      });
      await Promise.all(removals);
    } finally {
      await Promise.all([rm(temporaryImagePath, { force: true }), rm(temporaryMetadataPath, { force: true })]);
    }

    void queueMissingVariants(url.href);
    return { kind: 'fetched' };
  } finally {
    clearTimeout(deadline);
    releaseFetchSlot();
  }
};

export const fetchAndCacheImageWithDetails = async (sourceUrl: string): Promise<ImageProxyResult> => {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return { kind: 'invalid-url' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) return { kind: 'invalid-url' };

  const { cacheState } = await getCacheState();
  if (await runCacheMutation(cacheState, async () => Boolean(getCachedImageEntry(cacheState, url.href)))) {
    void queueMissingVariants(url.href);
    return { kind: 'cached' };
  }

  const existingRequest = inFlightRequests.get(url.href);
  if (existingRequest) return existingRequest;

  const request = fetchAndCacheUncachedImage(url).finally(() => inFlightRequests.delete(url.href));
  inFlightRequests.set(url.href, request);
  return request;
};

export const fetchAndCacheImage = async (sourceUrl: string): Promise<boolean> => {
  const result = await fetchAndCacheImageWithDetails(sourceUrl);
  return result.kind === 'cached' || result.kind === 'fetched';
};

export const getCachedImage = async (sourceUrl: string, variant?: ProxyImageVariant): Promise<CachedImage | null> => {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return null;
  }

  const { cacheFolder, cacheState } = await getCacheState();
  const cachedRead = await runCacheMutation(cacheState, async () => {
    const cached = getCachedImageEntry(cacheState, url.href);
    if (!cached) return null;
    return {
      cached,
      operation: runEntryFileMutation(cacheState, cached.metadataPath, async () => {
        if (variant) {
          try {
            const buffer = await readFile(join(cacheFolder, getVariantFileName(getCacheKey(url.href), variant)));
            if (buffer.byteLength > 0) {
              return { contentType: IMAGE_CACHE_VARIANT_CONTENT_TYPE, buffer, fallback: false };
            }
          } catch {
            void queueMissingVariants(url.href);
          }
        }

        return {
          contentType: cached.metadata.contentType,
          buffer: await readFile(cached.imagePath),
          fallback: Boolean(variant),
        };
      }),
    };
  });
  if (!cachedRead) return null;
  try {
    const image = await cachedRead.operation;
    if (image.fallback) void queueMissingVariants(url.href);
    return image;
  } catch {
    const removal = await runCacheMutation(cacheState, async () =>
      cacheState.entries.get(cachedRead.cached.metadataPath) === cachedRead.cached
        ? removeCacheEntry(cacheState, cachedRead.cached)
        : null
    );
    await removal;
    return null;
  }
};
