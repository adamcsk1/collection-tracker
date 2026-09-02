import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenLibraryExternalMetadataProvider } from './openlibrary-provider';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('OpenLibraryExternalMetadataProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps search results using canonical ISBN-13 identities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
            {
              title: 'The Book',
              first_publish_year: 1965,
              author_name: ['Author One', 'Author Two'],
              subject: ['Fiction, Science fiction'],
              isbn: ['invalid', '0-306-40615-2'],
              cover_edition_key: 'OL1M',
              editions: { docs: [{ key: 'OL1M', isbn: ['0-306-40615-2'] }] },
            },
          ],
        })
      )
    );

    const result = await new OpenLibraryExternalMetadataProvider('https://books.example/').search('the book');

    const requestUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://books.example/search.json');
    expect(requestUrl.searchParams.get('q')).toBe('the book');
    expect(requestUrl.searchParams.get('limit')).toBe('20');
    expect(requestUrl.searchParams.get('fields')).toContain('editions.isbn');
    expect(requestUrl.searchParams.get('fields')).toContain('editions.cover_i');
    expect(requestUrl.searchParams.get('fields')).not.toContain('editions.isbn_13');
    expect(result.results).toEqual([
      {
        provider: 'openlibrary',
        providerItemId: '9780306406157',
        externalIds: [{ source: 'isbn', id: '9780306406157' }],
        title: 'The Book',
        year: '1965',
        contentType: 'book',
        poster: 'https://covers.openlibrary.org/b/isbn/9780306406157-M.jpg?default=false',
        plot: '',
        actors: 'Author One, Author Two',
        genres: ['Fiction', 'Science fiction'],
        ratings: [],
      },
    ]);
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('maps ISBN details, description objects, covers, subjects, and author records', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string) => {
        if (input.endsWith('/authors/OL1A.json')) {
          return jsonResponse({ name: 'Author One' });
        }
        return jsonResponse({
          title: 'Detailed Book',
          publish_date: 'April 1965',
          description: { value: 'Book plot' },
          subjects: ['Physics, Astronomy'],
          covers: [-1, 123],
          authors: [{ key: '/authors/OL1A' }, { name: 'Author Two' }],
        });
      })
    );

    const item = await new OpenLibraryExternalMetadataProvider('https://books.example/').getItem('0-306-40615-2');

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://books.example/isbn/9780306406157.json');
    expect(item).toEqual({
      provider: 'openlibrary',
      providerItemId: '9780306406157',
      externalIds: [{ source: 'isbn', id: '9780306406157' }],
      title: 'Detailed Book',
      year: '1965',
      contentType: 'book',
      poster: 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false',
      plot: 'Book plot',
      actors: 'Author One, Author Two',
      genres: ['Physics', 'Astronomy'],
      ratings: [],
    });
  });

  it('returns null for invalid or missing ISBNs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenLibraryExternalMetadataProvider();

    await expect(provider.getItem('invalid')).resolves.toBeNull();
    await expect(provider.getItem('9780306406157')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch untrusted author URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ title: 'Book', authors: [{ key: 'https://attacker.example/author' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await new OpenLibraryExternalMetadataProvider().getItem('9780306406157');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads exact ISBN searches from the edition endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          title: 'Exact Edition Title',
          publish_date: '1988',
          covers: [123],
          authors: [{ name: 'Exact Author' }],
        })
      )
    );

    const result = await new OpenLibraryExternalMetadataProvider().search('0-306-40615-2');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe('/isbn/9780306406157.json');
    expect(result.results[0]?.providerItemId).toBe('9780306406157');
    expect(result.results[0]?.title).toBe('Exact Edition Title');
    expect(result.results[0]?.year).toBe('1988');
    expect(result.results[0]?.poster).toBe('https://covers.openlibrary.org/b/id/123-M.jpg?default=false');
  });

  it('extracts ISBN from an Open Library URL during search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          title: 'URL Edition Title',
          publish_date: '1965',
          covers: [123],
          authors: [{ name: 'URL Author' }],
        })
      )
    );

    const result = await new OpenLibraryExternalMetadataProvider().search('https://openlibrary.org/isbn/9780306406157');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe('/isbn/9780306406157.json');
    expect(result.results[0]?.providerItemId).toBe('9780306406157');
    expect(result.results[0]?.title).toBe('URL Edition Title');
  });

  it('uses the cover edition ISBN for title searches and deduplicates canonical ISBNs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
            {
              title: 'The Book',
              isbn: ['9780306406157', '9780140328721'],
              cover_edition_key: 'OL2M',
              editions: {
                docs: [
                  { key: 'OL1M', title: 'Other Book', isbn: ['9780306406157'] },
                  { key: 'OL2M', title: 'The Book', isbn: ['0-14-032872-6'], cover_i: 456 },
                ],
              },
            },
            {
              title: 'Duplicate',
              isbn: ['9780140328721'],
              editions: { docs: [{ isbn_13: ['9780140328721'] }] },
            },
          ],
        })
      )
    );

    const result = await new OpenLibraryExternalMetadataProvider().search('The Book');

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.providerItemId).toBe('9780140328721');
    expect(result.results[0]?.poster).toBe('https://covers.openlibrary.org/b/id/456-M.jpg?default=false');
  });

  it('keeps a custom base path without a trailing slash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ docs: [] })));

    await new OpenLibraryExternalMetadataProvider('https://books.example/api').search('book');

    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe('/api/search.json');
  });

  it('falls back from negative cover IDs and limits author lookups to five', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) =>
      jsonResponse(
        input.includes('/authors/')
          ? { name: input.match(/OL\d+A/)?.[0] }
          : {
              title: 'Book',
              covers: [-1],
              authors: Array.from({ length: 7 }, (_, index) => ({ key: `/authors/OL${index + 1}A` })),
            }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const item = await new OpenLibraryExternalMetadataProvider().getItem('9780306406157');

    expect(item?.poster).toBe('https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false');
    expect(item?.actors).toBe('OL1A, OL2A, OL3A, OL4A, OL5A');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
