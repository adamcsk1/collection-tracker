import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BACKGROUND_IMDB_IDS } from './background-const';

describe('background images', () => {
  let dataFolder: string | null = null;
  let getCachedImage: ReturnType<typeof vi.fn>;
  let fetchAndCacheImage: ReturnType<typeof vi.fn>;
  let getItemByImdbId: ReturnType<typeof vi.fn>;

  const importBackground = async (config?: object | string) => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-background-'));
    if (config !== undefined) {
      writeFileSync(
        join(dataFolder, 'background.config.json'),
        typeof config === 'string' ? config : JSON.stringify(config),
        { encoding: 'utf-8' }
      );
    }

    getCachedImage = vi.fn(async () => null);
    fetchAndCacheImage = vi.fn(async () => true);
    getItemByImdbId = vi.fn(async (imdbId: string) => ({ poster: `https://images.example/${imdbId}.jpg` }));

    vi.doMock('../argv/argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));
    vi.doMock('../image/image-proxy', () => ({ getCachedImage, fetchAndCacheImage }));
    vi.doMock('../external-metadata/external-metadata-provider-factory', () => ({
      getDirectImdbExternalMetadataProvider: () => ({ getItemByImdbId }),
    }));
    vi.doMock('../logger', () => ({ debugLog: vi.fn() }));

    return import('./background');
  };

  afterEach(() => {
    if (dataFolder) rmSync(dataFolder, { recursive: true, force: true });
    dataFolder = null;
    vi.resetModules();
    vi.doUnmock('../argv/argv');
    vi.doUnmock('../image/image-proxy');
    vi.doUnmock('../external-metadata/external-metadata-provider-factory');
    vi.doUnmock('../logger');
  });

  it('uses default IMDb IDs when the config file is missing', async () => {
    const { getBackgroundImdbIds } = await importBackground();

    expect(getBackgroundImdbIds()).toEqual([...DEFAULT_BACKGROUND_IMDB_IDS]);
  });

  it('reads unique valid IMDb IDs from the config file and caps the list', async () => {
    const { getBackgroundImdbIds } = await importBackground({
      imdbIds: ['tt0111161', 'TT0111161', 'not-an-id', 'tt0068646', 12],
    });

    expect(getBackgroundImdbIds()).toEqual(['tt0111161', 'tt0068646']);
  });

  it('keeps an explicit empty IMDb ID list', async () => {
    const { getBackgroundImdbIds } = await importBackground({ imdbIds: [] });

    expect(getBackgroundImdbIds()).toEqual([]);
  });

  it('falls back to defaults when the config file is invalid JSON', async () => {
    const { getBackgroundImdbIds } = await importBackground('{');

    expect(getBackgroundImdbIds()).toEqual([...DEFAULT_BACKGROUND_IMDB_IDS]);
  });

  it('skips warmup when no IMDb metadata provider is configured', async () => {
    dataFolder = mkdtempSync(join(tmpdir(), 'collection-tracker-background-'));
    getCachedImage = vi.fn(async () => null);
    fetchAndCacheImage = vi.fn(async () => true);
    vi.doMock('../argv/argv', () => ({ getArgv: () => ({ dataFolder, debug: false }) }));
    vi.doMock('../image/image-proxy', () => ({ getCachedImage, fetchAndCacheImage }));
    vi.doMock('../external-metadata/external-metadata-provider-factory', () => ({
      getDirectImdbExternalMetadataProvider: () => null,
    }));
    vi.doMock('../logger', () => ({ debugLog: vi.fn() }));
    const { warmBackgroundImages, getCachedBackgroundImageUrls } = await import('./background');

    await warmBackgroundImages();

    expect(fetchAndCacheImage).not.toHaveBeenCalled();
    expect(await getCachedBackgroundImageUrls()).toEqual([]);
  });

  it('caches missing posters during warmup and lists only cached URLs', async () => {
    const { warmBackgroundImages, getCachedBackgroundImageUrls, isBackgroundImageUrl } = await importBackground({
      imdbIds: ['tt0111161', 'tt0068646'],
    });
    getCachedImage.mockImplementation(async (sourceUrl: string) =>
      sourceUrl.endsWith('tt0111161.jpg') ? { contentType: 'image/jpeg', buffer: Buffer.from('img') } : null
    );

    await warmBackgroundImages();

    expect(getItemByImdbId).toHaveBeenCalledWith('tt0111161');
    expect(getItemByImdbId).toHaveBeenCalledWith('tt0068646');
    expect(fetchAndCacheImage).toHaveBeenCalledTimes(1);
    expect(fetchAndCacheImage).toHaveBeenCalledWith('https://images.example/tt0068646.jpg');
    expect(await getCachedBackgroundImageUrls()).toEqual(['https://images.example/tt0111161.jpg']);
    expect(isBackgroundImageUrl('https://images.example/tt0111161.jpg')).toBe(true);
    expect(isBackgroundImageUrl('https://images.example/other.jpg')).toBe(false);
  });

  it('skips posters that are missing, N/A, or not http URLs', async () => {
    const { warmBackgroundImages, isBackgroundImageUrl } = await importBackground({
      imdbIds: ['tt0111161', 'tt0068646', 'tt0071562'],
    });
    getItemByImdbId.mockImplementation(async (imdbId: string) => {
      if (imdbId === 'tt0111161') return { poster: 'N/A' };
      if (imdbId === 'tt0068646') return { poster: '' };
      return { poster: '/relative.jpg' };
    });

    await warmBackgroundImages();

    expect(fetchAndCacheImage).not.toHaveBeenCalled();
    expect(isBackgroundImageUrl('N/A')).toBe(false);
  });

  it('does not warm twice until the config file changes', async () => {
    const { warmBackgroundImages } = await importBackground({ imdbIds: ['tt0111161'] });

    await warmBackgroundImages();
    await warmBackgroundImages();
    expect(getItemByImdbId).toHaveBeenCalledTimes(1);

    const configPath = join(dataFolder!, 'background.config.json');
    writeFileSync(configPath, JSON.stringify({ imdbIds: ['tt0068646'] }), { encoding: 'utf-8' });
    utimesSync(configPath, new Date(Date.now() + 1000), new Date(Date.now() + 1000));

    await warmBackgroundImages();
    expect(getItemByImdbId).toHaveBeenCalledTimes(2);
    expect(getItemByImdbId).toHaveBeenLastCalledWith('tt0068646');
  });
});
