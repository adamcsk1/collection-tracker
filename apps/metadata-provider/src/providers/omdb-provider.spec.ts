import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OMDB_API_URL, OMDB_REQUEST_TIMEOUT_MS } from './omdb-const';
import { OmdbExternalMetadataProvider } from './omdb-provider';
import { debugLog, errorLog } from '../core/logger';

vi.mock('../core/logger', () => ({
  debugLog: vi.fn(),
  errorLog: vi.fn(),
}));

describe('OmdbExternalMetadataProvider', () => {
  let provider: OmdbExternalMetadataProvider;

  beforeEach(() => {
    provider = new OmdbExternalMetadataProvider('test-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the default OMDb URL with the search query and API key', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response);

    await provider.search('The Matrix & Reloaded');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    const defaultUrl = new URL(DEFAULT_OMDB_API_URL);
    expect(requestUrl.origin).toBe(defaultUrl.origin);
    expect(requestUrl.pathname).toBe(defaultUrl.pathname);
    expect(requestUrl.searchParams.get('s')).toBe('The Matrix & Reloaded');
    expect(requestUrl.searchParams.get('apikey')).toBe('test-key');
  });

  it('uses a custom OMDb URL', async () => {
    provider = new OmdbExternalMetadataProvider('custom-key', 'https://metadata.example.com/omdb/');
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response);

    await provider.search('custom search');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://metadata.example.com/omdb/');
    expect(requestUrl.searchParams.get('s')).toBe('custom search');
    expect(requestUrl.searchParams.get('apikey')).toBe('custom-key');
  });

  it('aborts OMDb requests after the configured timeout', async () => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ Search: [] }) } as Response);

    await provider.search('timeout test');

    expect(timeoutSpy).toHaveBeenCalledWith(OMDB_REQUEST_TIMEOUT_MS);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), { signal });
  });

  it('returns an empty search result when OMDb reports no matches', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
    } as Response);

    await expect(provider.search('missing')).resolves.toEqual({ results: [] });
  });

  it('throws upstream errors for non-not-found OMDb errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Invalid API key!' }),
    } as Response);

    await expect(provider.getItem('tt0133093')).rejects.toEqual(new Error('Invalid API key!'));
  });

  it('returns empty search results for an overly broad query', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Too many results.' }),
    } as Response);

    await expect(provider.search('le')).resolves.toEqual({ results: [] });
    expect(debugLog).toHaveBeenCalledWith('omdb search returned too many results; refine the search text');
    await expect(provider.getItem('tt0133093')).rejects.toThrow('Too many results.');
  });

  it.each(['Invalid API key!', 'Request limit reached!'])('keeps search failures for %s', async (message) => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: message }),
    } as Response);
    await expect(provider.search('le')).rejects.toThrow(message);
  });

  it('keeps HTTP and timeout search failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    await expect(provider.search('le')).rejects.toThrow('omdb responded with 503');
    const error = new DOMException('aborted', 'TimeoutError');
    vi.mocked(fetch).mockRejectedValueOnce(error);
    await expect(provider.search('le')).rejects.toBe(error);
  });

  it('throws upstream errors for failed HTTP responses', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(provider.getItem('tt0133093')).rejects.toEqual(new Error('omdb responded with 503'));
  });

  it('maps unavailable OMDb posters to empty strings in search and item lookup', async () => {
    const searchItem = {
      imdbID: 'tt0133093',
      Title: 'The Matrix',
      Year: '1999',
      Type: 'movie',
      Poster: 'https://images.test/matrix.jpg',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Search: [searchItem, { ...searchItem, imdbID: 'tt0234215', Title: 'Reloaded', Poster: 'N/A' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...searchItem, Type: 'series', Poster: ' n/a ' }),
      } as Response);

    await expect(provider.search('matrix')).resolves.toEqual({
      results: [
        expect.objectContaining({ providerItemId: 'tt0133093', poster: 'https://images.test/matrix.jpg' }),
        expect.objectContaining({ providerItemId: 'tt0234215', poster: '' }),
      ],
    });
    await expect(provider.getItem('tt0133093')).resolves.toMatchObject({
      contentType: 'series',
      poster: '',
    });
  });

  it('maps ratings to generic source values and skips malformed rating entries', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        imdbID: 'tt0133093',
        imdbRating: '8.7',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '83%' }, { Source: 'Metacritic' }, { Source: 123, Value: 'bad' }],
        Type: 'movie',
        Title: 'The Matrix',
        Year: '1999',
        Poster: 42,
        Plot: 'plot',
        Actors: 'actors',
        Genre: 'Sci-Fi, Action',
      }),
    } as Response);

    await expect(provider.getItem('tt0133093')).resolves.toMatchObject({
      providerItemId: 'tt0133093',
      title: 'The Matrix',
      poster: '',
      genres: ['Sci-Fi', 'Action'],
      ratings: [
        { source: 'Rotten Tomatoes', value: '83%' },
        { source: 'Internet Movie Database', value: '8.7' },
      ],
    });
  });

  it('returns series season metadata while ignoring failed season requests', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totalSeasons: '2' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Episodes: [{ Title: 'Pilot' }, { Title: 42 }] }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await expect(provider.getSeriesSeasons('tt-series')).resolves.toEqual([
      { season: 1, episodes: 2, titles: ['Pilot', ''] },
    ]);
    expect(errorLog).toHaveBeenCalledWith('omdb season fetch season=2 error=omdb responded with 500');
  });

  it('logs a failed initial series lookup while keeping best-effort behavior', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('private upstream data', 'TimeoutError'));
    await expect(provider.getSeriesSeasons('tt-series')).resolves.toEqual([]);
    expect(errorLog).toHaveBeenCalledWith('omdb series info fetch error=Metadata request timed out or was aborted');
  });
});
