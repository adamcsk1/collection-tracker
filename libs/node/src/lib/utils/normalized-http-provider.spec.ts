import { ExternalMetadataSeasonProvider } from '../models/external-metadata-runtime-model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNormalizedHttpExternalMetadataProvider } from './normalized-http-provider';

const item = {
  providerItemId: 'tt0133093',
  externalIds: [{ source: 'imdb', id: 'tt0133093' }],
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: 'https://images.test/matrix.jpg',
  plot: 'Plot',
  actors: 'Actors',
  genres: ['Action'],
  ratings: [{ source: 'IMDb', value: '8.7' }],
};

const jsonResponse = (data: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

describe('normalized HTTP external metadata provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches the normalized endpoint, authenticates, and stamps the configured provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [{ ...item, provider: 'ignored' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
      header: { name: 'X-Api-Key', value: 'secret' },
    });

    await expect(provider.search('matrix & neo')).resolves.toEqual({
      results: [{ ...item, provider: 'omdb' }],
    });
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(requestUrl.href).toBe('https://metadata.test/v1/search?s=matrix+%26+neo');
    expect(new Headers(requestInit.headers).get('X-Api-Key')).toBe('secret');
    expect(requestInit.redirect).toBe('error');
  });

  it('returns null when an item is not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const provider = createNormalizedHttpExternalMetadataProvider('openlibrary', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.getItem('0-306-40615-2')).resolves.toBeNull();
    expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('https://metadata.test/v1/items/9780306406157');
  });

  it('rejects content types outside the replaced provider slot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [{ ...item, contentType: 'book' }] })));
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.search('matrix')).rejects.toThrow('unsupported content type');
  });

  it('accepts empty posters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [{ ...item, poster: '' }] })));
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.search('matrix')).resolves.toEqual({
      results: [{ ...item, provider: 'omdb', poster: '' }],
    });
  });

  it('rejects non-HTTP poster URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ results: [{ ...item, poster: 'file:///poster.jpg' }] }))
    );
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.search('matrix')).rejects.toThrow('invalid poster');
  });

  it('rejects non-JSON and oversized responses', async () => {
    const provider = createNormalizedHttpExternalMetadataProvider('musicbrainz', {
      baseUrl: 'https://metadata.test/v1/',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('text', { status: 200 })));
    await expect(provider.search('album')).rejects.toThrow('did not return JSON');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json', 'content-length': `${2 * 1024 * 1024 + 1}` },
        })
      )
    );
    await expect(provider.search('album')).rejects.toThrow('too large');
  });

  it('stops reading a chunked response when it exceeds the response limit', async () => {
    const provider = createNormalizedHttpExternalMetadataProvider('musicbrainz', {
      baseUrl: 'https://metadata.test/v1/',
    });
    const chunk = new Uint8Array(1024 * 1024 + 1);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(chunk);
              controller.enqueue(chunk);
              controller.close();
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(provider.search('album')).rejects.toThrow('too large');
  });

  it('supports direct IMDb item and season operations for OMDb replacements', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(item))
      .mockResolvedValueOnce(jsonResponse({ seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }] }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    }) as ExternalMetadataSeasonProvider;

    await expect(provider.getItemByImdbId?.('tt0133093')).resolves.toEqual({ ...item, provider: 'omdb' });
    await expect(provider.getSeriesSeasons('tt0133093')).resolves.toEqual([
      { season: 1, episodes: 2, titles: ['Pilot', 'Second'] },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url.toString())).toEqual([
      'https://metadata.test/v1/items/by-imdb/tt0133093',
      'https://metadata.test/v1/items/tt0133093/seasons',
    ]);
  });

  it('does not advertise OMDb-only capabilities for other replacements', () => {
    const provider = createNormalizedHttpExternalMetadataProvider('openlibrary', {
      baseUrl: 'https://metadata.test/v1/',
    });

    expect(provider.supportsDirectImdbId).toBeUndefined();
    expect(provider.getItemByImdbId).toBeUndefined();
    expect('getSeriesSeasons' in provider).toBe(false);
  });

  it('trims identity fields from replacement items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          results: [{ ...item, providerItemId: ' tt0133093 ', externalIds: [{ source: 'imdb', id: ' tt0133093 ' }] }],
        })
      )
    );
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.search('matrix')).resolves.toEqual({
      results: [
        { ...item, provider: 'omdb', providerItemId: 'tt0133093', externalIds: [{ source: 'imdb', id: 'tt0133093' }] },
      ],
    });
  });

  it('does not fetch escaped or invalid lookup IDs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const books = createNormalizedHttpExternalMetadataProvider('openlibrary', {
      baseUrl: 'https://metadata.test/v1/',
    });
    const movies = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    }) as ExternalMetadataSeasonProvider;

    await expect(books.getItem('.')).resolves.toBeNull();
    await expect(books.getItem('..')).resolves.toBeNull();
    await expect(movies.getItemByImdbId?.('.')).resolves.toBeNull();
    await expect(movies.getItemByImdbId?.('..')).resolves.toBeNull();
    await expect(movies.getSeriesSeasons('.')).rejects.toThrow('request path is invalid');
    await expect(movies.getSeriesSeasons('..')).rejects.toThrow('request path is invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects replacement items that do not use the slot identity scheme', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ results: [{ ...item, providerItemId: 'tmdb-1' }] }))
    );
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    });

    await expect(provider.search('matrix')).rejects.toThrow('invalid providerItemId');
  });

  it('rejects duplicate season numbers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          seasons: [
            { season: 1, episodes: 2 },
            { season: 1, episodes: 3 },
          ],
        })
      )
    );
    const provider = createNormalizedHttpExternalMetadataProvider('omdb', {
      baseUrl: 'https://metadata.test/v1/',
    }) as ExternalMetadataSeasonProvider;

    await expect(provider.getSeriesSeasons('tt0133093')).rejects.toThrow('duplicate season metadata');
  });
});
