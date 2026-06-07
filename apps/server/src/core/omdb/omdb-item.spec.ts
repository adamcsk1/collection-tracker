import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOMDbItem } from './omdb-item';

vi.mock('../logger', () => ({
  debugLog: vi.fn(),
}));

describe('fetchOMDbItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns OMDb item data for successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ imdbID: 'tt001', Title: 'Movie' }),
        })
      )
    );

    const item = await fetchOMDbItem('tt001', 'key');

    expect(item).toEqual({ imdbID: 'tt001', Title: 'Movie' });
    expect(fetch).toHaveBeenCalledWith('https://www.omdbapi.com/?i=tt001&apikey=key');
  });

  it('returns null for non-OK responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    );

    await expect(fetchOMDbItem('tt001', 'key')).resolves.toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network error')))
    );

    await expect(fetchOMDbItem('tt001', 'key')).resolves.toBeNull();
  });
});
