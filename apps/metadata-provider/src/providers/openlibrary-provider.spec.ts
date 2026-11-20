import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenLibraryExternalMetadataProvider } from './openlibrary-provider';
import { OPENLIBRARY_REQUEST_INTERVAL_MS, OPENLIBRARY_USER_AGENT } from './openlibrary-const';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const provider = () => new OpenLibraryExternalMetadataProvider('https://books.example/');

describe('OpenLibraryExternalMetadataProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('paces official requests across instances and identifies the application', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ docs: [] })))
    );
    const first = new OpenLibraryExternalMetadataProvider().search('first');
    const second = new OpenLibraryExternalMetadataProvider().search('second');
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(OPENLIBRARY_REQUEST_INTERVAL_MS - 1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ headers: { 'User-Agent': OPENLIBRARY_USER_AGENT } });
  });

  it('returns works without ISBNs, deduplicates works, and skips malformed entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
            {
              key: '/works/OL1W',
              title: 'Book',
              first_publish_year: 1965,
              author_name: ['Author'],
              subject: ['Fiction, Fantasy'],
              cover_i: 123,
            },
            { key: '/works/OL1W', title: 'Duplicate' },
            { key: 'OL2W', title: 'No cover' },
            null,
            { key: '/works/invalid', title: 'Invalid' },
          ],
        })
      )
    );
    const result = await provider().search('Book');
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      provider: 'openlibrary',
      providerItemId: 'OL1W',
      externalIds: [{ source: 'openlibrary', id: 'OL1W' }],
      title: 'Book',
      year: '1965',
      contentType: 'book',
      poster: 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false',
      plot: '',
      actors: 'Author',
      genres: ['Fiction', 'Fantasy'],
      ratings: [],
    });
    expect(result.results[1].poster).toBe('');
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url.pathname).toBe('/search.json');
    expect(url.searchParams.get('fields')).not.toContain('editions');
  });

  it('loads work details and nested author references without requiring an edition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) =>
        jsonResponse(
          input.includes('/authors/')
            ? { name: 'Author' }
            : {
                title: 'Work',
                first_publish_date: '1901',
                description: { value: 'Plot' },
                authors: [{ author: { key: '/authors/OL1A' } }],
                covers: [123],
              }
        )
      )
    );
    const item = await provider().getItem('ol1w');
    expect(item).toMatchObject({ providerItemId: 'OL1W', title: 'Work', year: '1901', plot: 'Plot', actors: 'Author' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://books.example/works/OL1W.json');
  });

  it('keeps legacy ISBN lookup identity and enriches missing edition metadata from its work', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) =>
        jsonResponse(
          input.includes('/works/')
            ? {
                title: 'Work',
                description: 'Work plot',
                subjects: ['Fiction'],
                authors: [{ name: 'Author' }],
                covers: [42],
              }
            : { title: 'Edition', publish_date: '1988', works: [{ key: '/works/OL1W' }] }
        )
      )
    );
    expect(await provider().getItem('0-306-40615-2')).toMatchObject({
      providerItemId: '9780306406157',
      title: 'Edition',
      year: '1988',
      plot: 'Work plot',
      actors: 'Author',
      genres: ['Fiction'],
      externalIds: [
        { source: 'isbn', id: '9780306406157' },
        { source: 'openlibrary', id: 'OL1W' },
      ],
      poster: 'https://covers.openlibrary.org/b/id/42-L.jpg?default=false',
    });
    expect((await provider().search('0-306-40615-2')).results[0].providerItemId).toBe('OL1W');
  });

  it('retains edition lookup when no work link exists or enrichment fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async (input: string) =>
          input.includes('/works/')
            ? new Response(null, { status: 503 })
            : jsonResponse({ title: 'Edition', description: 'Edition plot', works: [{ key: '/works/OL1W' }] })
        )
    );
    expect(await provider().getItem('9780306406157')).toMatchObject({
      providerItemId: '9780306406157',
      plot: 'Edition plot',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ title: 'Edition', works: [{ key: 'https://attacker.test/work' }] }))
    );
    expect((await provider().search('9780306406157')).results[0].providerItemId).toBe('9780306406157');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles missing and malformed details and rejects invalid IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await provider().getItem('invalid')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(await provider().getItem('OL1W')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null)));
    expect(await provider().getItem('9780306406157')).toBeNull();
  });

  it('does not equate an anthology with an arbitrary work', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ title: 'Anthology', works: [{ key: '/works/OL1W' }, { key: '/works/OL2W' }] })
        )
    );
    const result = await provider().search('9780306406157');
    expect(result.results[0]).toMatchObject({
      providerItemId: '9780306406157',
      externalIds: [{ source: 'isbn', id: '9780306406157' }],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('limits author lookups, tolerates failures, and never follows untrusted author URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) =>
        input.includes('/authors/')
          ? new Response(null, { status: 503 })
          : jsonResponse({
              title: 'Book',
              covers: [-1],
              authors: [
                null,
                { key: 'https://attacker.test/author' },
                ...Array.from({ length: 7 }, (_, index) => ({ key: `/authors/OL${index + 1}A` })),
              ],
            })
      )
    );
    const item = await provider().getItem('9780306406157');
    expect(item?.actors).toBe('');
    expect(item?.poster).toBe('https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('preserves custom base paths and accepts work URLs for discovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ title: 'Work' })));
    await new OpenLibraryExternalMetadataProvider('https://books.example/api').search(
      'https://openlibrary.org/works/OL1W/Work'
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://books.example/api/works/OL1W.json');
  });
});
