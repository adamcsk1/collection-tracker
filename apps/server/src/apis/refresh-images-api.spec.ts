import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/logger', () => ({
  debugLog: vi.fn(),
  errorLog: vi.fn(),
}));

let fetchAndCacheImageResult = true;

const insertUser = () => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
};

const insertItem = (imdbId: string, image: string, hash = 'hash') => {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', imdbId, 'Title', 'title', '', '', '', image, hash);
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

    vi.doMock('../core/image/image-proxy-service', () => ({
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

    vi.doMock('../core/image/image-proxy-service', () => ({
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

    vi.doMock('../core/image/image-proxy-service', () => ({
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
    const row = db.prepare('SELECT image FROM collection_items WHERE imdb_id = ?').get('tt-1') as { image: string };
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

    vi.doMock('../core/image/image-proxy-service', () => ({
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

  it('increments errors when OMDb API key is missing', async () => {
    insertUser();
    insertItem('tt-1', 'https://images.example/broken.jpg');

    fetchAndCacheImageResult = false;
    delete process.env.OMDB_API_KEY;

    vi.doMock('../core/image/image-proxy-service', () => ({
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
});
