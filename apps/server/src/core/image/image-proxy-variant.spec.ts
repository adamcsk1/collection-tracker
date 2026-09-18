import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getArgv } from '../argv/argv';

vi.mock('../argv/argv', () => ({ getArgv: vi.fn() }));

describe('image-proxy variants', () => {
  let temporaryDataFolder: string;

  beforeEach(() => {
    temporaryDataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-image-variants-'));
    vi.mocked(getArgv).mockReturnValue({
      dataFolder: temporaryDataFolder,
      debug: false,
      metadataServiceUrl: '',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    rmSync(temporaryDataFolder, { force: true, recursive: true });
  });

  const seedOriginal = async (sourceUrl: string): Promise<{ cacheFolder: string; cacheKey: string; png: Buffer }> => {
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder, { recursive: true });
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    const png = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();
    writeFileSync(join(cacheFolder, `${cacheKey}.png`), png);
    writeFileSync(
      join(cacheFolder, `${cacheKey}.json`),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/png',
        fileName: `${cacheKey}.png`,
        size: png.byteLength,
        sourceUrl,
      })
    );
    return { cacheFolder, cacheKey, png };
  };

  it('backfills missing webp variants from cached originals', async () => {
    const sourceUrl = 'http://images.example/poster.png';
    const { cacheFolder, cacheKey } = await seedOriginal(sourceUrl);
    const { backfillImageCacheVariants, getCachedImage } = await import('./image-proxy');

    await backfillImageCacheVariants();

    expect(existsSync(join(cacheFolder, `${cacheKey}.card.webp`))).toBe(true);
    expect(existsSync(join(cacheFolder, `${cacheKey}.background.webp`))).toBe(true);

    const card = await getCachedImage(sourceUrl, 'card');
    expect(card?.contentType).toBe('image/webp');
    expect(card?.fallback).toBe(false);
    expect((await sharp(card!.buffer).metadata()).width).toBeLessThanOrEqual(480);

    const background = await getCachedImage(sourceUrl, 'background');
    expect((await sharp(background!.buffer).metadata()).width).toBeLessThanOrEqual(240);
  });

  it('serves the original when a requested variant is missing', async () => {
    const sourceUrl = 'http://images.example/fallback.png';
    const { png } = await seedOriginal(sourceUrl);
    const { getCachedImage } = await import('./image-proxy');

    await expect(getCachedImage(sourceUrl, 'card')).resolves.toEqual({
      contentType: 'image/png',
      buffer: png,
      fallback: true,
    });
  });

  it('leaves undecodable originals readable when variant generation fails', async () => {
    const sourceUrl = 'http://images.example/broken.jpg';
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder, { recursive: true });
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    writeFileSync(join(cacheFolder, `${cacheKey}.jpg`), 'not-an-image');
    writeFileSync(
      join(cacheFolder, `${cacheKey}.json`),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: `${cacheKey}.jpg`,
        size: 12,
        sourceUrl,
      })
    );
    const { backfillImageCacheVariants, getCachedImage } = await import('./image-proxy');

    await expect(backfillImageCacheVariants()).resolves.toBeUndefined();
    await expect(getCachedImage(sourceUrl, 'card')).resolves.toEqual({
      contentType: 'image/jpeg',
      buffer: Buffer.from('not-an-image'),
      fallback: true,
    });
    expect(existsSync(join(cacheFolder, `${cacheKey}.card.webp`))).toBe(false);
  });

  it('keeps generated thumbnails after an access-metadata flush', async () => {
    const sourceUrl = 'http://images.example/flush.png';
    const { cacheFolder, cacheKey } = await seedOriginal(sourceUrl);
    const { backfillImageCacheVariants, getCachedImage } = await import('./image-proxy');

    await backfillImageCacheVariants();
    vi.useFakeTimers();
    await getCachedImage(sourceUrl);
    await vi.advanceTimersByTimeAsync(1100);

    await expect(getCachedImage(sourceUrl, 'card')).resolves.toMatchObject({
      contentType: 'image/webp',
      fallback: false,
    });
    expect(existsSync(join(cacheFolder, `${cacheKey}.card.webp`))).toBe(true);
  });

  it('rotates EXIF-oriented originals before generating thumbnails', async () => {
    const sourceUrl = 'http://images.example/oriented.jpg';
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder, { recursive: true });
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    const jpeg = await sharp({
      create: { width: 80, height: 160, channels: 3, background: { r: 200, g: 20, b: 20 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    writeFileSync(join(cacheFolder, `${cacheKey}.jpg`), jpeg);
    writeFileSync(
      join(cacheFolder, `${cacheKey}.json`),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/jpeg',
        fileName: `${cacheKey}.jpg`,
        size: jpeg.byteLength,
        sourceUrl,
      })
    );
    const { backfillImageCacheVariants, getCachedImage } = await import('./image-proxy');

    await backfillImageCacheVariants();
    const card = await getCachedImage(sourceUrl, 'card');

    expect(card?.fallback).toBe(false);
    expect((await sharp(card!.buffer).metadata()).width).toBe(160);
  });

  it('evicts older originals and their thumbnails when variant writes exceed quota', async () => {
    vi.resetModules();
    vi.doMock('./image-proxy-const', async (importOriginal) => ({
      ...(await importOriginal<typeof import('./image-proxy-const')>()),
      IMAGE_CACHE_MAX_BYTES: 30_000,
    }));
    vi.doMock('sharp', () => ({
      default: () => ({
        autoOrient() {
          return this;
        },
        resize() {
          return this;
        },
        webp() {
          return this;
        },
        toBuffer: async () => Buffer.alloc(8_000),
      }),
    }));
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder, { recursive: true });
    const oldUrl = 'http://images.example/old.png';
    const keptUrl = 'http://images.example/kept.png';
    const oldKey = createHash('sha256').update(oldUrl).digest('hex');
    const keptKey = createHash('sha256').update(keptUrl).digest('hex');
    writeFileSync(join(cacheFolder, `${oldKey}.png`), 'old');
    writeFileSync(
      join(cacheFolder, `${oldKey}.json`),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/png',
        fileName: `${oldKey}.png`,
        size: 3,
        sourceUrl: oldUrl,
      })
    );
    writeFileSync(join(cacheFolder, `${keptKey}.png`), 'kept');
    writeFileSync(
      join(cacheFolder, `${keptKey}.json`),
      JSON.stringify({
        accessedAt: 2,
        contentType: 'image/png',
        fileName: `${keptKey}.png`,
        size: 4,
        sourceUrl: keptUrl,
      })
    );
    const { backfillImageCacheVariants } = await import('./image-proxy');

    await backfillImageCacheVariants();

    expect(existsSync(join(cacheFolder, `${oldKey}.png`))).toBe(false);
    expect(existsSync(join(cacheFolder, `${oldKey}.json`))).toBe(false);
    expect(existsSync(join(cacheFolder, `${oldKey}.card.webp`))).toBe(false);
    expect(existsSync(join(cacheFolder, `${oldKey}.background.webp`))).toBe(false);
    expect(existsSync(join(cacheFolder, `${keptKey}.png`))).toBe(true);
    expect(existsSync(join(cacheFolder, `${keptKey}.card.webp`))).toBe(true);
  });

  it('keeps variant bytes in quota after an access-metadata flush', async () => {
    vi.resetModules();
    vi.doMock('./image-proxy-const', async (importOriginal) => ({
      ...(await importOriginal<typeof import('./image-proxy-const')>()),
      IMAGE_CACHE_MAX_BYTES: 50_000,
    }));
    vi.doMock('sharp', () => ({
      default: () => ({
        autoOrient() {
          return this;
        },
        resize() {
          return this;
        },
        webp() {
          return this;
        },
        toBuffer: async () => Buffer.alloc(8_000),
      }),
    }));
    vi.doMock('dns/promises', () => ({
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    }));
    const incoming = Buffer.alloc(20_000, 7);
    const request = vi.fn((_options: unknown, callback: (response: NodeJS.ReadableStream) => void) => {
      const response = Readable.from([incoming]) as Readable & {
        statusCode?: number;
        headers: Record<string, string>;
      };
      response.statusCode = 200;
      response.headers = { 'content-type': 'image/jpeg', 'content-length': `${incoming.byteLength}` };
      callback(response);
      return { end() {}, destroy() {}, on() {} };
    });
    vi.doMock('http', () => ({ request, default: { request } }));
    vi.doMock('https', () => ({ request, default: { request } }));
    const cacheFolder = join(temporaryDataFolder, 'cache');
    mkdirSync(cacheFolder, { recursive: true });
    const sourceUrl = 'http://images.example/flush-quota.png';
    const cacheKey = createHash('sha256').update(sourceUrl).digest('hex');
    writeFileSync(join(cacheFolder, `${cacheKey}.png`), 'png');
    writeFileSync(
      join(cacheFolder, `${cacheKey}.json`),
      JSON.stringify({
        accessedAt: 1,
        contentType: 'image/png',
        fileName: `${cacheKey}.png`,
        size: 3,
        sourceUrl,
      })
    );
    const { backfillImageCacheVariants, fetchAndCacheImageWithDetails, getCachedImage } = await import('./image-proxy');

    await backfillImageCacheVariants();
    vi.useFakeTimers();
    await getCachedImage(sourceUrl);
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    await expect(fetchAndCacheImageWithDetails('http://images.example/incoming.jpg')).resolves.toEqual({
      kind: 'fetched',
    });

    expect(existsSync(join(cacheFolder, `${cacheKey}.png`))).toBe(false);
    expect(existsSync(join(cacheFolder, `${cacheKey}.card.webp`))).toBe(false);
  });
});
