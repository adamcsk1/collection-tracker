import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare, insertShare } from '../../test/mocks/share-mock';

vi.mock('../core/logger', () => ({
  debugLog: vi.fn(),
  errorLog: vi.fn(),
}));

let fetchAndCacheImageResult = true;

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (imdbId: string, image: string, hash = 'hash', usernameHash = 'user', listType = 'library') => {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
     VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, imdbId, `imdb:${imdbId}`, listType, 'Title', 'title', '', '', image, hash);
};

const insertBookItem = (isbn: string, image: string, hash = 'hash', usernameHash = 'user') => {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
     VALUES (?, 'openlibrary', ?, ?, 'books', 'book', ?, ?, ?, ?, ?, ?)`
  ).run(usernameHash, isbn, `openlibrary:${isbn}`, 'Book Title', 'book title', '2021', '', image, hash);
};

describe('refresh-images-api', () => {
  beforeEach(() => {
    fetchAndCacheImageResult = true;
    process.env.OMDB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OMDB_API_KEY;
  });

  it('returns zero counts for an empty collection', async () => {
    insertUser();

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 0, checked: 0, fixed: 0, errors: 0 });
  });

  it('returns success when all images are available', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/poster1.jpg');
    insertItem('tt-2', 'https://images.example/poster2.jpg');

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 2, checked: 2, fixed: 0, errors: 0 });
  });

  it('fetches OMDb and updates item when image is not available', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/broken.jpg');

    fetchAndCacheImageResult = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-1',
          Poster: 'https://images.example/new-poster.jpg',
        }),
      }))
    );

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 1, errors: 0 });

    const db = getDatabase();
    const row = db.prepare('SELECT image FROM collection_items WHERE external_item_id = ?').get('tt-1') as {
      image: string;
    };
    expect(row.image).toBe('https://images.example/new-poster.jpg');
  });

  it('increments errors when OMDb has no new poster', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/broken.jpg');

    fetchAndCacheImageResult = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-1',
          Poster: 'https://images.example/broken.jpg',
        }),
      }))
    );

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
  });

  it('does not update the image when the provider returns a different-cased item ID', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/broken.jpg');

    fetchAndCacheImageResult = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'TT-1',
          Poster: 'https://images.example/wrong-poster.jpg',
        }),
      }))
    );

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
    expect(
      (
        getDatabase().prepare('SELECT image FROM collection_items WHERE external_item_id = ?').get('tt-1') as {
          image: string;
        }
      ).image
    ).toBe('https://images.example/broken.jpg');
  });

  it('increments errors when OMDb API key is missing', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/broken.jpg');

    fetchAndCacheImageResult = false;
    delete process.env.OMDB_API_KEY;

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 1 });
  });

  it('refreshes a shared library when the user has update permission and ignores non-library items', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canUpdate: true });
    insertItem('tt-own', 'https://images.example/own.jpg', 'own-hash', 'user');
    insertItem('tt-shared', 'https://images.example/shared-broken.jpg', 'shared-hash', 'owner');
    insertItem(
      'tt-shared-watchlist',
      'https://images.example/owner-watchlist-broken.jpg',
      'watchlist-hash',
      'owner',
      'up-next'
    );
    insertBookItem('9780140328721', 'https://images.example/owner-book-broken.jpg', 'book-hash', 'owner');

    fetchAndCacheImageResult = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imdbID: 'tt-shared',
          Poster: 'https://images.example/shared-new.jpg',
        }),
      }))
    );

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 1, errors: 0 });

    const rows = getDatabase()
      .prepare(
        'SELECT username_hash, external_item_id, image, list_type FROM collection_items ORDER BY list_type, username_hash, external_item_id'
      )
      .all() as Array<{ username_hash: string; external_item_id: string; image: string; list_type: string }>;
    expect(rows).toEqual([
      {
        username_hash: 'owner',
        external_item_id: '9780140328721',
        image: 'https://images.example/owner-book-broken.jpg',
        list_type: 'books',
      },
      {
        username_hash: 'owner',
        external_item_id: 'tt-shared',
        image: 'https://images.example/shared-new.jpg',
        list_type: 'library',
      },
      {
        username_hash: 'user',
        external_item_id: 'tt-own',
        image: 'https://images.example/own.jpg',
        list_type: 'library',
      },
      {
        username_hash: 'owner',
        external_item_id: 'tt-shared-watchlist',
        image: 'https://images.example/owner-watchlist-broken.jpg',
        list_type: 'up-next',
      },
    ]);
  });

  it('rejects shared image refresh without update permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('refreshes only shared content types with update permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('tt-movie', 'movie.jpg', 'movie-hash', 'owner');
    insertItem('tt-series', 'series.jpg', 'series-hash', 'owner');
    getDatabase()
      .prepare("UPDATE collection_items SET content_type = 'series' WHERE external_item_id = ?")
      .run('tt-series');
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
      },
    ]);
    const imageMock = vi.fn(async () => true);
    vi.doMock('../core/image/image-proxy', () => ({ fetchAndCacheImage: imageMock }));
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ count: 1, checked: 1, fixed: 0, errors: 0 });
    expect(imageMock).toHaveBeenCalledOnce();
  });

  it('refreshes books and items across all lists for a personal library', async () => {
    insertUser();
    insertBookItem('9780140328721', 'https://images.example/broken-book.jpg');
    insertItem('tt-watchlist', 'https://images.example/broken-watchlist.jpg', 'watchlist-hash', 'user', 'up-next');

    fetchAndCacheImageResult = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('9780140328721') || url.includes('isbn/')) {
          return {
            ok: true,
            json: async () => ({
              title: 'Book Title',
              publish_date: '2000',
              covers: [12345],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            imdbID: 'tt-watchlist',
            Poster: 'https://images.example/watchlist-new.jpg',
          }),
        };
      })
    );

    vi.doMock('../core/image/image-proxy', () => ({
      fetchAndCacheImage: vi.fn(async () => fetchAndCacheImageResult),
    }));

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-images-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ count: 2, checked: 2, fixed: 2, errors: 0 });

    const rows = getDatabase()
      .prepare('SELECT external_item_id, image, list_type FROM collection_items ORDER BY list_type, external_item_id')
      .all() as Array<{ external_item_id: string; image: string; list_type: string }>;
    expect(rows).toEqual([
      {
        external_item_id: '9780140328721',
        image: 'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false',
        list_type: 'books',
      },
      {
        external_item_id: 'tt-watchlist',
        image: 'https://images.example/watchlist-new.jpg',
        list_type: 'up-next',
      },
    ]);
  });
});
