import { afterEach, describe, expect, it, vi } from 'vitest';

describe('fetchSeriesSeasonMetadata', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses the provider season capability when available', async () => {
    const getSeriesSeasons = vi.fn(async () => [{ season: 1, episodes: 2, titles: ['One', 'Two'] }]);
    vi.doMock('./external-metadata-provider-factory', () => ({
      getExternalMetadataProviderByName: (providerName: string) =>
        providerName === 'test' ? { name: 'test', search: vi.fn(), getItem: vi.fn(), getSeriesSeasons } : null,
    }));

    const { fetchSeriesSeasonMetadata } = await import('./series-season-metadata');

    await expect(fetchSeriesSeasonMetadata('test', 'tt-series')).resolves.toEqual([
      { season: 1, episodes: 2, titles: ['One', 'Two'] },
    ]);
    expect(getSeriesSeasons).toHaveBeenCalledWith('tt-series');
  });

  it('returns no seasons when the provider has no season capability', async () => {
    vi.doMock('./external-metadata-provider-factory', () => ({
      getExternalMetadataProviderByName: () => ({ name: 'test', search: vi.fn(), getItem: vi.fn() }),
    }));

    const { fetchSeriesSeasonMetadata } = await import('./series-season-metadata');

    await expect(fetchSeriesSeasonMetadata('test', 'tt-series')).resolves.toEqual([]);
  });

  it('propagates season lookup failures', async () => {
    vi.doMock('./external-metadata-provider-factory', () => ({
      getExternalMetadataProviderByName: () => ({
        name: 'omdb',
        search: vi.fn(),
        getItem: vi.fn(),
        getSeriesSeasons: vi.fn(async () => {
          throw new Error('replacement failed');
        }),
      }),
    }));

    const { fetchSeriesSeasonMetadata, tryFetchSeriesSeasonMetadata } = await import('./series-season-metadata');

    await expect(fetchSeriesSeasonMetadata('omdb', 'tt-series')).rejects.toThrow('replacement failed');
    await expect(tryFetchSeriesSeasonMetadata('omdb', 'tt-series')).resolves.toEqual([]);
  });
});
