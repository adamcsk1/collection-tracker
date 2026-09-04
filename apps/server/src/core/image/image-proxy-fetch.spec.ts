import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getArgv } from '../argv/argv';
import {
  FETCH_TIMEOUT_MS,
  IMAGE_CACHE_ENTRY_OVERHEAD_BYTES,
  IMAGE_CACHE_MAX_BYTES,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_PROXY_CONCURRENCY,
  IMAGE_PROXY_QUEUE_MAX,
  IMAGE_PROXY_QUEUE_TIMEOUT_MS,
  MAX_IMAGE_BYTES,
} from './image-proxy-const';

const requestState = vi.hoisted(() => ({
  createdRequests: [] as Array<EventEmitter & { destroy: ReturnType<typeof vi.fn>; end: () => void }>,
  createdResponses: [] as Readable[],
  lookup: vi.fn(async () => [{ address: '8.8.8.8', family: 4 as const }]),
  largeFilePath: undefined as string | undefined,
  largeFileSize: undefined as number | undefined,
  skipMkdir: false,
  slowFileStarted: false,
  slowFilePath: undefined as string | undefined,
  slowFileWait: undefined as Promise<void> | undefined,
  responses: [] as Array<{
    statusCode: number;
    contentType?: string;
    contentLength?: number;
    location?: string;
    body?: string;
    responseDelayMs?: number;
    waitForBody?: Promise<void>;
  }>,
}));

vi.mock('./image-cache-file', async (importOriginal) => {
  const original = await importOriginal<typeof import('./image-cache-file')>();
  return {
    ...original,
    mkdir: async (...args: Parameters<typeof original.mkdir>) =>
      requestState.skipMkdir ? undefined : original.mkdir(...args),
    readFile: async (...args: Parameters<typeof original.readFile>) => {
      if (requestState.slowFileWait && args[0].toString() === requestState.slowFilePath) {
        requestState.slowFileStarted = true;
        await requestState.slowFileWait;
      }
      return original.readFile(...args);
    },
    stat: async (...args: Parameters<typeof original.stat>) => {
      const stats = await original.stat(...args);
      if (requestState.largeFileSize !== undefined && args[0].toString() === requestState.largeFilePath) {
        Object.defineProperty(stats, 'size', { value: requestState.largeFileSize });
      }
      return stats;
    },
    writeFile: async (...args: Parameters<typeof original.writeFile>) => {
      if (requestState.slowFileWait && args[0].toString().includes(requestState.slowFilePath ?? '')) {
        requestState.slowFileStarted = true;
        await requestState.slowFileWait;
      }
      return original.writeFile(...args);
    },
  };
});

vi.mock('dns/promises', () => ({ default: { lookup: requestState.lookup }, lookup: requestState.lookup }));
vi.mock('../argv/argv', () => ({ getArgv: vi.fn() }));

const requestMockFactory = () =>
  vi.fn(
    (
      _options: unknown,
      callback: (
        response: Readable & {
          statusCode?: number;
          headers: Record<string, string | string[] | undefined>;
          resume: () => void;
        }
      ) => void
    ) => {
      const clientRequest = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: ReturnType<typeof vi.fn>;
      };
      let destroyed = false;
      clientRequest.end = async () => {
        const configured = requestState.responses.shift()!;
        if (configured.responseDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, configured.responseDelayMs));
        }
        if (destroyed) return;
        const body = async function* () {
          if (configured.waitForBody) await configured.waitForBody;
          yield configured.body ?? 'image';
        };
        const response = Readable.from(body()) as Readable & {
          statusCode?: number;
          headers: Record<string, string | string[] | undefined>;
          resume: () => void;
        };
        response.statusCode = configured.statusCode;
        response.headers = {
          'content-type': configured.contentType,
          'content-length': configured.contentLength === undefined ? undefined : `${configured.contentLength}`,
          location: configured.location,
        };
        requestState.createdResponses.push(response);
        callback(response);
      };
      clientRequest.destroy = vi.fn((error: Error) => {
        destroyed = true;
        clientRequest.emit('error', error);
      });
      requestState.createdRequests.push(clientRequest);
      return clientRequest;
    }
  );

vi.mock('http', () => {
  const request = requestMockFactory();
  return { default: { request }, request };
});
vi.mock('https', () => {
  const request = requestMockFactory();
  return { default: { request }, request };
});

describe('image-proxy fetch responses', () => {
  let temporaryDataFolder: string;

  beforeEach(() => {
    temporaryDataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-proxy-'));
    vi.mocked(getArgv).mockReturnValue({
      dataFolder: temporaryDataFolder,
      debug: false,
      metadataServiceUrl: '',
    });
    requestState.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    requestState.largeFilePath = undefined;
    requestState.largeFileSize = undefined;
    requestState.createdRequests = [];
    requestState.createdResponses = [];
    requestState.responses = [];
    requestState.skipMkdir = false;
    requestState.slowFileStarted = false;
    requestState.slowFilePath = undefined;
    requestState.slowFileWait = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    rmSync(temporaryDataFolder, { force: true, recursive: true });
  });

  it.each([
    [
      { statusCode: 404, contentType: 'image/jpeg' },
      { kind: 'upstream-error', statusCode: 404 },
    ],
    [{ statusCode: 200, contentType: 'text/plain' }, { kind: 'not-image' }],
    [{ statusCode: 200, contentType: 'image/jpeg', contentLength: 50_000_001 }, { kind: 'too-large' }],
  ] as const)('handles non-cacheable upstream responses', async (response, expected) => {
    requestState.responses.push(response);
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    expect(
      await fetchAndCacheImageWithDetails(`http://images.example/${response.statusCode}-${response.contentType}`)
    ).toEqual(expected);
  });

  it('destroys an oversized declared response before releasing its fetch slot', async () => {
    requestState.responses.push({
      statusCode: 200,
      contentType: 'image/jpeg',
      contentLength: MAX_IMAGE_BYTES + 1,
    });
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(fetchAndCacheImageWithDetails('http://images.example/oversized.jpg')).resolves.toEqual({
      kind: 'too-large',
    });

    expect(requestState.createdResponses[0].destroyed).toBe(true);
  });

  it('enforces an absolute upstream deadline while the response remains active', async () => {
    vi.useFakeTimers();
    const waitForBody = new Promise<void>(() => undefined);
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg', waitForBody });
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const fetchPromise = fetchAndCacheImageWithDetails('http://images.example/slow.jpg');
    const rejection = expect(fetchPromise).rejects.toThrow('Image proxy request timed out');
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);

    await rejection;
    expect(requestState.createdResponses[0].destroyed).toBe(true);
  });

  it('applies the operation deadline while DNS resolution is pending', async () => {
    vi.useFakeTimers();
    requestState.lookup.mockImplementation(() => new Promise(() => undefined));
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const fetchPromise = fetchAndCacheImageWithDetails('http://slow-dns.example/poster.jpg');
    const rejection = expect(fetchPromise).rejects.toThrow('Image proxy request timed out');
    await vi.waitFor(() => expect(requestState.lookup).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);

    await rejection;
    expect(request).not.toHaveBeenCalled();
  });

  it('omits TLS servername for an HTTPS IPv6 literal while preserving the bracketed URL host', async () => {
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg' });
    const { request } = await import('https');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(
      fetchAndCacheImageWithDetails('https://[2606:4700:4700::1111]:8443/poster.jpg?size=large')
    ).resolves.toEqual({ kind: 'fetched' });

    expect(requestState.lookup).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: 'https:',
        hostname: '2606:4700:4700::1111',
        family: 6,
        port: '8443',
        path: '/poster.jpg?size=large',
        headers: { Host: '[2606:4700:4700::1111]:8443', 'User-Agent': 'CollectionTracker/1.0' },
      }),
      expect.any(Function)
    );
    expect(vi.mocked(request).mock.calls[0][0]).not.toHaveProperty('servername');
  });

  it('uses the DNS hostname as TLS servername while connecting to its resolved address', async () => {
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg' });
    const { request } = await import('https');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(fetchAndCacheImageWithDetails('https://images.example:8443/poster.jpg')).resolves.toEqual({
      kind: 'fetched',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '8.8.8.8',
        family: 4,
        servername: 'images.example',
        headers: { Host: 'images.example:8443', 'User-Agent': 'CollectionTracker/1.0' },
      }),
      expect.any(Function)
    );
  });

  it.each(['::', '::1', 'fc00::1', 'fe80::1', 'ff00::1', '::ffff:127.0.0.1'])(
    'blocks private IPv6 literal %s without DNS resolution',
    async (address) => {
      const { request } = await import('http');
      const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

      await expect(fetchAndCacheImageWithDetails(`http://[${address}]/poster.jpg`)).resolves.toEqual({
        kind: 'blocked',
      });
      expect(requestState.lookup).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    }
  );

  it('uses one absolute deadline across a slow redirect chain', async () => {
    vi.useFakeTimers();
    requestState.responses.push(
      {
        statusCode: 302,
        contentType: 'text/plain',
        location: '/hop-1.jpg',
        responseDelayMs: 20_000,
      },
      {
        statusCode: 200,
        contentType: 'image/jpeg',
        responseDelayMs: 20_000,
      }
    );
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const fetchPromise = fetchAndCacheImageWithDetails('http://images.example/slow-redirect');
    const rejection = expect(fetchPromise).rejects.toThrow('Image proxy request timed out');
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
    expect(requestState.createdRequests[1].destroy).toHaveBeenCalledOnce();
  });

  it('follows a safe relative redirect', async () => {
    requestState.responses.push(
      { statusCode: 302, contentType: 'text/plain', location: '/poster.jpg' },
      { statusCode: 200, contentType: 'image/jpeg', body: 'jpeg' }
    );
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    expect(await fetchAndCacheImageWithDetails('http://images.example/redirect')).toEqual({
      kind: 'fetched',
    });
    expect(readdirSync(join(temporaryDataFolder, 'cache'))).toHaveLength(2);
  });

  it('follows a 307 redirect to another public host', async () => {
    requestState.responses.push(
      { statusCode: 307, contentType: 'text/plain', location: 'http://archive.example/mbid-front.jpg' },
      { statusCode: 200, contentType: 'image/jpeg', body: 'jpeg' }
    );
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    expect(await fetchAndCacheImageWithDetails('http://coverart.example/release/mbid/front-250')).toEqual({
      kind: 'fetched',
    });
  });

  it('rejects a zero-byte image without creating a cache entry', async () => {
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg', body: '' });
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(fetchAndCacheImageWithDetails('http://images.example/empty.jpg')).resolves.toEqual({
      kind: 'not-image',
    });
    expect(readdirSync(join(temporaryDataFolder, 'cache'))).toEqual([]);
  });

  it('caps cache quota at 10,000 entries with 8 KiB overhead per entry', async () => {
    const { isImageCacheQuotaExceeded } = await import('./image-proxy');

    expect(IMAGE_CACHE_MAX_ENTRIES).toBe(10_000);
    expect(IMAGE_CACHE_ENTRY_OVERHEAD_BYTES).toBe(8 * 1024);
    expect(isImageCacheQuotaExceeded(0, IMAGE_CACHE_MAX_ENTRIES - 1, 1)).toBe(false);
    expect(isImageCacheQuotaExceeded(0, IMAGE_CACHE_MAX_ENTRIES, 1)).toBe(true);
  });

  it('scans the cache directory only once across repeated misses', async () => {
    requestState.responses.push(
      { statusCode: 200, contentType: 'text/plain' },
      { statusCode: 200, contentType: 'text/plain' }
    );
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await fetchAndCacheImageWithDetails('http://images.example/miss-1');
    const orphanPath = join(temporaryDataFolder, 'cache', 'added-after-initialization.jpg');
    writeFileSync(orphanPath, 'orphan');
    await fetchAndCacheImageWithDetails('http://images.example/miss-2');

    expect(existsSync(orphanPath)).toBe(true);
  });

  it('does not block an independent cache hit while an image file read is slow', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const slowUrl = 'http://images.example/slow-cached.jpg';
    const fastUrl = 'http://images.example/fast-cached.jpg';
    const slowImagePath = join(cacheFolder, 'slow.jpg');
    writeFileSync(slowImagePath, 'slow');
    writeFileSync(join(cacheFolder, 'fast.jpg'), 'fast');
    for (const [name, sourceUrl] of [
      ['slow', slowUrl],
      ['fast', fastUrl],
    ]) {
      writeFileSync(
        join(cacheFolder, `${name}.json`),
        JSON.stringify({ accessedAt: 1, contentType: 'image/jpeg', fileName: `${name}.jpg`, size: 4, sourceUrl })
      );
    }
    let releaseRead!: () => void;
    requestState.slowFilePath = slowImagePath;
    requestState.slowFileWait = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const { fetchAndCacheImageWithDetails, getCachedImage } = await import('./image-proxy');

    const slowRead = getCachedImage(slowUrl);
    await vi.waitFor(() => expect(requestState.slowFileStarted).toBe(true));
    await expect(fetchAndCacheImageWithDetails(fastUrl)).resolves.toEqual({ kind: 'cached' });
    releaseRead();
    await expect(slowRead).resolves.toMatchObject({ contentType: 'image/jpeg' });
  });

  it('does not block an independent cache hit while cache files are being written', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const cachedUrl = 'http://images.example/cached.jpg';
    writeFileSync(join(cacheFolder, 'cached.jpg'), 'cached');
    writeFileSync(
      join(cacheFolder, 'cached.json'),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: 'cached.jpg',
        size: 6,
        sourceUrl: cachedUrl,
      })
    );
    let releaseWrite!: () => void;
    requestState.slowFilePath = '.tmp';
    requestState.slowFileWait = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg', body: 'new' });
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const slowWrite = fetchAndCacheImageWithDetails('http://images.example/new-slow-write.jpg');
    await vi.waitFor(() => expect(requestState.slowFileStarted).toBe(true));
    await expect(fetchAndCacheImageWithDetails(cachedUrl)).resolves.toEqual({ kind: 'cached' });
    releaseWrite();
    await expect(slowWrite).resolves.toEqual({ kind: 'fetched' });
  });

  it('deduplicates simultaneous requests for the same image', async () => {
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg', body: 'jpeg' });
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const results = await Promise.all([
      fetchAndCacheImageWithDetails('http://images.example/same.jpg'),
      fetchAndCacheImageWithDetails('http://images.example/same.jpg'),
    ]);

    expect(request).toHaveBeenCalledOnce();
    expect(results).toEqual([{ kind: 'fetched' }, { kind: 'fetched' }]);
  });

  it('limits simultaneous upstream image fetches to four', async () => {
    let releaseBodies!: () => void;
    const waitForBody = new Promise<void>((resolve) => {
      releaseBodies = resolve;
    });
    requestState.responses = Array.from({ length: 6 }, () => ({
      statusCode: 200,
      contentType: 'image/jpeg',
      body: 'jpeg',
      waitForBody,
    }));
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const requests = Array.from({ length: 6 }, (_, index) =>
      fetchAndCacheImageWithDetails(`http://images.example/${index}.jpg`)
    );
    try {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(IMAGE_PROXY_CONCURRENCY));
    } finally {
      releaseBodies();
      await Promise.allSettled(requests);
    }
    expect(request).toHaveBeenCalledTimes(6);
  });

  it('rejects requests beyond the bounded fetch queue', async () => {
    let releaseBodies!: () => void;
    const waitForBody = new Promise<void>((resolve) => {
      releaseBodies = resolve;
    });
    const acceptedRequestCount = IMAGE_PROXY_CONCURRENCY + IMAGE_PROXY_QUEUE_MAX;
    requestState.responses = Array.from({ length: acceptedRequestCount }, () => ({
      statusCode: 200,
      contentType: 'image/jpeg',
      body: 'jpeg',
      waitForBody,
    }));
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');
    const acceptedRequests = Array.from({ length: acceptedRequestCount }, (_, index) =>
      fetchAndCacheImageWithDetails(`http://images.example/queued-${index}.jpg`)
    );
    try {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(IMAGE_PROXY_CONCURRENCY));
      await expect(fetchAndCacheImageWithDetails('http://images.example/queue-full.jpg')).resolves.toEqual({
        kind: 'busy',
      });
    } finally {
      releaseBodies();
      await Promise.allSettled(acceptedRequests);
    }
  });

  it('expires a queued fetch after the queue wait timeout', async () => {
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');
    await fetchAndCacheImageWithDetails('http://127.0.0.1/initialize-cache.jpg');
    let releaseBodies!: () => void;
    const waitForBody = new Promise<void>((resolve) => {
      releaseBodies = resolve;
    });
    requestState.responses = Array.from({ length: IMAGE_PROXY_CONCURRENCY + IMAGE_PROXY_QUEUE_MAX }, () => ({
      statusCode: 200,
      contentType: 'image/jpeg',
      body: 'jpeg',
      waitForBody,
    }));
    const { request } = await import('http');
    const activeRequests = Array.from({ length: IMAGE_PROXY_CONCURRENCY }, (_, index) =>
      fetchAndCacheImageWithDetails(`http://images.example/active-${index}.jpg`)
    );
    let queuedRequests: Array<Promise<Awaited<ReturnType<typeof fetchAndCacheImageWithDetails>>>> = [];
    let queueTimersExpired = false;
    try {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(IMAGE_PROXY_CONCURRENCY));
      requestState.skipMkdir = true;
      vi.useFakeTimers();
      queuedRequests = Array.from({ length: IMAGE_PROXY_QUEUE_MAX }, (_, index) =>
        fetchAndCacheImageWithDetails(`http://images.example/queue-timeout-${index}.jpg`)
      );
      for (
        let attempt = 0;
        attempt < IMAGE_PROXY_QUEUE_MAX * 8 && vi.getTimerCount() < IMAGE_PROXY_QUEUE_MAX;
        attempt += 1
      ) {
        await Promise.resolve();
      }
      expect(vi.getTimerCount()).toBe(IMAGE_PROXY_QUEUE_MAX);
      await expect(fetchAndCacheImageWithDetails('http://images.example/queue-overflow.jpg')).resolves.toEqual({
        kind: 'busy',
      });

      await vi.advanceTimersByTimeAsync(IMAGE_PROXY_QUEUE_TIMEOUT_MS);
      queueTimersExpired = true;
      await expect(Promise.all(queuedRequests)).resolves.toEqual(
        Array.from({ length: IMAGE_PROXY_QUEUE_MAX }, () => ({ kind: 'busy' }))
      );
      expect(request).toHaveBeenCalledTimes(IMAGE_PROXY_CONCURRENCY);
    } finally {
      if (queuedRequests.length && !queueTimersExpired) {
        await vi.advanceTimersByTimeAsync(IMAGE_PROXY_QUEUE_TIMEOUT_MS);
      }
      vi.useRealTimers();
      releaseBodies();
      await Promise.allSettled([...queuedRequests, ...activeRequests]);
    }
  });

  it('keeps a same-path replacement after eviction waits for an active read', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const sourceUrl = 'http://images.example/replaced.jpg';
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    const imagePath = join(cacheFolder, `${cacheKey}.jpg`);
    const metadataPath = join(cacheFolder, `${cacheKey}.json`);
    writeFileSync(imagePath, 'old');
    requestState.largeFilePath = imagePath;
    requestState.largeFileSize = IMAGE_CACHE_MAX_BYTES - 1024 * 1024;
    writeFileSync(
      metadataPath,
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: `${cacheKey}.jpg`,
        size: IMAGE_CACHE_MAX_BYTES - 1024 * 1024,
        sourceUrl,
      })
    );
    let releaseRead!: () => void;
    requestState.slowFilePath = imagePath;
    requestState.slowFileWait = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    requestState.responses.push(
      { statusCode: 200, contentType: 'image/jpeg', body: 'x'.repeat(2 * 1024 * 1024) },
      { statusCode: 200, contentType: 'image/jpeg', body: 'replacement' }
    );
    const { request } = await import('http');
    const { fetchAndCacheImageWithDetails, getCachedImage } = await import('./image-proxy');
    const activeRead = getCachedImage(sourceUrl);
    let eviction: Promise<Awaited<ReturnType<typeof fetchAndCacheImageWithDetails>>> | undefined;
    let replacement: Promise<Awaited<ReturnType<typeof fetchAndCacheImageWithDetails>>> | undefined;

    try {
      await vi.waitFor(() => expect(requestState.slowFileStarted).toBe(true));
      const incomingUrl = 'http://images.example/quota-trigger.jpg';
      eviction = fetchAndCacheImageWithDetails(incomingUrl);
      const incomingKey = createHash('sha256').update(incomingUrl).digest('hex');
      await vi.waitFor(() => expect(existsSync(join(cacheFolder, `${incomingKey}.jpg`))).toBe(true));

      replacement = fetchAndCacheImageWithDetails(sourceUrl);
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    } finally {
      releaseRead();
      await Promise.allSettled([activeRead, ...(eviction ? [eviction] : []), ...(replacement ? [replacement] : [])]);
    }

    await expect(eviction!).resolves.toEqual({ kind: 'fetched' });
    await expect(replacement!).resolves.toEqual({ kind: 'fetched' });
    expect(readFileSync(imagePath, 'utf-8')).toBe('replacement');
  });

  it('keeps pre-upgrade cache metadata that omits accessedAt and size', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const sourceUrl = 'http://images.example/legacy.jpg';
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    const imagePath = join(cacheFolder, `${cacheKey}.jpg`);
    const metadataPath = join(cacheFolder, `${cacheKey}.json`);
    writeFileSync(imagePath, 'legacy-image');
    writeFileSync(
      metadataPath,
      JSON.stringify({
        contentType: 'image/jpeg',
        fileName: `${cacheKey}.jpg`,
        sourceUrl,
      })
    );
    const { fetchAndCacheImageWithDetails, getCachedImage } = await import('./image-proxy');

    await expect(fetchAndCacheImageWithDetails(sourceUrl)).resolves.toEqual({ kind: 'cached' });
    await expect(getCachedImage(sourceUrl)).resolves.toEqual({
      contentType: 'image/jpeg',
      buffer: Buffer.from('legacy-image'),
    });
    expect(existsSync(imagePath)).toBe(true);
    expect(existsSync(metadataPath)).toBe(true);
  });

  it('evicts the least recently used image before exceeding the cache quota', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const oldImagePath = join(cacheFolder, 'old.jpg');
    const recentImagePath = join(cacheFolder, 'recent.jpg');
    writeFileSync(oldImagePath, '');
    writeFileSync(recentImagePath, '');
    writeFileSync(join(cacheFolder, 'orphan.jpg'), 'orphan');
    writeFileSync(join(cacheFolder, 'malformed.json'), '{');
    writeFileSync(
      join(cacheFolder, 'missing.json'),
      JSON.stringify({
        accessedAt: 3,
        contentType: 'image/jpeg',
        fileName: 'missing.jpg',
        size: 1,
        sourceUrl: 'http://images.example/missing.jpg',
      })
    );
    truncateSync(oldImagePath, 256 * 1024 * 1024);
    truncateSync(recentImagePath, 256 * 1024 * 1024);
    writeFileSync(
      join(cacheFolder, 'old.json'),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: 'old.jpg',
        size: 256 * 1024 * 1024,
        sourceUrl: 'http://images.example/old.jpg',
      })
    );
    writeFileSync(
      join(cacheFolder, 'recent.json'),
      JSON.stringify({
        accessedAt: 2,
        contentType: 'image/jpeg',
        fileName: 'recent.jpg',
        size: 256 * 1024 * 1024,
        sourceUrl: 'http://images.example/recent.jpg',
      })
    );
    requestState.responses.push({ statusCode: 200, contentType: 'image/jpeg', body: 'new' });
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(fetchAndCacheImageWithDetails('http://images.example/new.jpg')).resolves.toEqual({ kind: 'fetched' });

    expect(existsSync(oldImagePath)).toBe(false);
    expect(existsSync(recentImagePath)).toBe(true);
    expect(existsSync(join(cacheFolder, 'orphan.jpg'))).toBe(false);
    expect(existsSync(join(cacheFolder, 'malformed.json'))).toBe(false);
    expect(existsSync(join(cacheFolder, 'missing.json'))).toBe(false);
    expect(readdirSync(cacheFolder)).toHaveLength(4);
  });

  it('keeps concurrent cache writes within the byte quota', async () => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder);
    const existingImagePath = join(cacheFolder, 'existing.jpg');
    writeFileSync(existingImagePath, '');
    truncateSync(existingImagePath, 500 * 1024 * 1024);
    writeFileSync(
      join(cacheFolder, 'existing.json'),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: 'existing.jpg',
        size: 500 * 1024 * 1024,
        sourceUrl: 'http://images.example/existing.jpg',
      })
    );
    const image = 'x'.repeat(4 * 1024 * 1024);
    requestState.responses = Array.from({ length: IMAGE_PROXY_CONCURRENCY }, () => ({
      statusCode: 200,
      contentType: 'image/jpeg',
      body: image,
    }));
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    await expect(
      Promise.all(
        Array.from({ length: IMAGE_PROXY_CONCURRENCY }, (_, index) =>
          fetchAndCacheImageWithDetails(`http://images.example/concurrent-${index}.jpg`)
        )
      )
    ).resolves.toEqual(Array.from({ length: IMAGE_PROXY_CONCURRENCY }, () => ({ kind: 'fetched' })));

    const fileNames = readdirSync(cacheFolder);
    const metadataCount = fileNames.filter((fileName) => fileName.endsWith('.json')).length;
    const cacheBytes =
      fileNames.reduce((total, fileName) => total + statSync(join(cacheFolder, fileName)).size, 0) +
      metadataCount * IMAGE_CACHE_ENTRY_OVERHEAD_BYTES;
    expect(cacheBytes).toBeLessThanOrEqual(IMAGE_CACHE_MAX_BYTES);
    expect(metadataCount).toBeLessThanOrEqual(IMAGE_CACHE_MAX_ENTRIES);
    expect(existsSync(existingImagePath)).toBe(false);
  });

  it.each([
    [{ statusCode: 302, contentType: 'text/plain' }, { kind: 'redirect' }],
    [{ statusCode: 302, contentType: 'text/plain', location: 'file:///poster.jpg' }, { kind: 'invalid-url' }],
    [{ statusCode: 302, contentType: 'text/plain', location: 'http://localhost/poster.jpg' }, { kind: 'blocked' }],
  ] as const)('rejects unsafe redirects', async (response, expected) => {
    requestState.responses.push(response);
    const { fetchAndCacheImageWithDetails } = await import('./image-proxy');

    const location = 'location' in response ? response.location : 'missing';
    expect(await fetchAndCacheImageWithDetails(`http://images.example/redirect-${location}`)).toEqual(expected);
  });
});
