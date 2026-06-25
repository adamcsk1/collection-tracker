import type { FastifyInstance } from 'fastify';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';

const insertUser = () => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
};

const insertItem = (item: {
  imdbId: string;
  title: string;
  tags?: string[];
  genres?: string[];
  actors?: string;
  plot?: string;
  rottenTomatoesRate?: string;
  metacriticRate?: string;
  createdAt?: string;
  listType?: CollectionListTypeModel;
  contentType?: 'movie' | 'series';
  favorite?: boolean;
}) => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
       (username_hash, imdb_id, title, title_lower, year, rate, rotten_tomatoes_rate, metacritic_rate, actors, plot, image, content_hash, list_type, content_type, favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`
    )
    .run(
      'user',
      item.imdbId,
      item.title,
      item.title.toLowerCase(),
      '2024',
      '8.0',
      item.rottenTomatoesRate ?? '',
      item.metacriticRate ?? '',
      item.actors ?? '',
      item.plot ?? '',
      '',
      `${item.imdbId}-hash`,
      item.listType ?? 'library',
      item.contentType ?? 'movie',
      item.favorite ? 1 : 0,
      item.createdAt ?? null
    );
  const itemId = Number(result.lastInsertRowid);

  for (const tag of item.tags ?? []) {
    getDatabase().prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }

  for (const genre of item.genres ?? []) {
    getDatabase().prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, genre);
  }
};

const callRoute = async (
  register: (app: FastifyInstance) => void,
  method: 'get' | 'post',
  path: string,
  request: any
) => {
  let handlerPromise: Promise<unknown> = Promise.resolve();
  const response = mockResponse();
  const app = {
    get: vi.fn((registeredPath: string, guardOrHandler: any, maybeHandler?: any) => {
      if (method !== 'get' || registeredPath !== path) return;
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
    post: vi.fn((registeredPath: string, guardOrHandler: any, maybeHandler?: any) => {
      if (method !== 'post' || registeredPath !== path) return;
      const handler = maybeHandler ?? guardOrHandler;
      handlerPromise = Promise.resolve(handler(request, response));
    }),
  } as any as FastifyInstance;

  register(app);
  await handlerPromise;
  return response;
};

describe('collection search APIs', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('searches items with system tag filters and pagination metadata', async () => {
    insertUser();
    insertItem({
      imdbId: 'tt-alien',
      title: 'Alien Movie',
      tags: ['#movie', '#space'],
      genres: ['Sci-Fi'],
      plot: 'space horror',
    });
    insertItem({ imdbId: 'tt-alien', title: 'Alien Movie', tags: ['#movie'], listType: 'movie-tracker' });
    insertItem({
      imdbId: 'tt-drama',
      title: 'Quiet Drama',
      tags: ['#series'],
      genres: ['Drama'],
      contentType: 'series',
    });
    const { register } = await import('./get-collection-items-api');

    const response = await callRoute(register, 'get', '/api/v1/items', {
      query: { search: 'space', type: 'movie', watched: 'true', limit: '10', offset: '0' },
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        offset: 0,
        limit: 10,
        items: [expect.objectContaining({ IMDbId: 'tt-alien' })],
      })
    );
  });

  it('filters unwatched library items across movies and series when no type is provided', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-unwatched-movie', title: 'Unwatched Movie', contentType: 'movie' });
    insertItem({ imdbId: 'tt-watched-movie', title: 'Watched Movie', contentType: 'movie' });
    insertItem({ imdbId: 'tt-watched-movie', title: 'Watched Movie', listType: 'movie-tracker', contentType: 'movie' });
    insertItem({ imdbId: 'tt-unwatched-series', title: 'Unwatched Series', contentType: 'series' });
    insertItem({ imdbId: 'tt-watched-series', title: 'Watched Series', contentType: 'series' });
    insertItem({
      imdbId: 'tt-watched-series',
      title: 'Watched Series',
      listType: 'series-tracker',
      contentType: 'series',
    });
    const { register } = await import('./get-collection-items-api');

    const response = await callRoute(register, 'get', '/api/v1/items', {
      query: { watched: 'false', limit: '10', offset: '0' },
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        items: expect.arrayContaining([
          expect.objectContaining({ IMDbId: 'tt-unwatched-movie' }),
          expect.objectContaining({ IMDbId: 'tt-unwatched-series' }),
        ]),
      })
    );
  });

  it('searches items by external ratings', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-rated', title: 'Rated Movie', rottenTomatoesRate: '96%', metacriticRate: '85/100' });
    insertItem({ imdbId: 'tt-other', title: 'Other Movie', rottenTomatoesRate: '50%', metacriticRate: '40/100' });
    const { register } = await import('./get-collection-items-api');

    const rottenTomatoesResponse = await callRoute(register, 'get', '/api/v1/items', {
      query: { search: '96%' },
      usernameHash: 'user',
    });
    const metacriticResponse = await callRoute(register, 'get', '/api/v1/items', {
      query: { search: '85/100' },
      usernameHash: 'user',
    });

    expect(rottenTomatoesResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1, items: [expect.objectContaining({ IMDbId: 'tt-rated' })] })
    );
    expect(metacriticResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1, items: [expect.objectContaining({ IMDbId: 'tt-rated' })] })
    );
  });

  it('orders items by created date and alphabet', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-alpha', title: 'Alpha', createdAt: '2024-01-01T00:00:00.000Z' });
    insertItem({ imdbId: 'tt-charlie', title: 'Charlie', createdAt: '2024-01-02T00:00:00.000Z' });
    insertItem({ imdbId: 'tt-bravo', title: 'Bravo', createdAt: '2024-01-03T00:00:00.000Z' });
    const { register } = await import('./get-collection-items-api');

    const createdAscendingResponse = await callRoute(register, 'get', '/api/v1/items', {
      query: { orderBy: 'createdAt', orderDirection: 'asc' },
      usernameHash: 'user',
    });
    const alphabetDescendingResponse = await callRoute(register, 'get', '/api/v1/items', {
      query: { orderBy: 'alphabet', orderDirection: 'desc' },
      usernameHash: 'user',
    });

    expect(createdAscendingResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ IMDbId: 'tt-alpha' }),
          expect.objectContaining({ IMDbId: 'tt-charlie' }),
          expect.objectContaining({ IMDbId: 'tt-bravo' }),
        ],
      })
    );
    expect(alphabetDescendingResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ IMDbId: 'tt-charlie' }),
          expect.objectContaining({ IMDbId: 'tt-bravo' }),
          expect.objectContaining({ IMDbId: 'tt-alpha' }),
        ],
      })
    );
  });

  it('returns matched IMDb IDs in the caller-provided order', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-first', title: 'First', createdAt: '2024-01-01T00:00:00.000Z' });
    insertItem({ imdbId: 'tt-second', title: 'Second', createdAt: '2024-01-02T00:00:00.000Z' });
    const { register } = await import('./collection-items-matched-api');

    const response = await callRoute(register, 'post', '/api/v1/items/matched', {
      body: { imdbIds: ['tt-first', 'tt-second'], limit: 10, offset: 0 },
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        items: [expect.objectContaining({ IMDbId: 'tt-first' }), expect.objectContaining({ IMDbId: 'tt-second' })],
      })
    );
  });

  it('returns search suggestions and known item validation', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-alien', title: 'Alien Movie', tags: ['#space'], actors: 'Sigourney Weaver' });
    const { register: registerSuggestions } = await import('./collection-items-search-suggestions-api');
    const { register: registerExists } = await import('./collection-items-exists-api');

    const suggestionsResponse = await callRoute(registerSuggestions, 'get', '/api/v1/items/search-suggestions', {
      query: { query: 'alien', limit: '5' },
      usernameHash: 'user',
    });
    const tagSuggestionsResponse = await callRoute(registerSuggestions, 'get', '/api/v1/items/search-suggestions', {
      query: { query: '#sp', limit: '5' },
      usernameHash: 'user',
    });
    const favoriteSuggestionsResponse = await callRoute(
      registerSuggestions,
      'get',
      '/api/v1/items/search-suggestions',
      {
        query: { query: '#fav', limit: '5' },
        usernameHash: 'user',
      }
    );
    const watchedSuggestionsResponse = await callRoute(registerSuggestions, 'get', '/api/v1/items/search-suggestions', {
      query: { query: '#watche', limit: '5' },
      usernameHash: 'user',
    });
    const unwatchedSuggestionsResponse = await callRoute(
      registerSuggestions,
      'get',
      '/api/v1/items/search-suggestions',
      {
        query: { query: '#unwat', limit: '5' },
        usernameHash: 'user',
      }
    );
    const existsResponse = await callRoute(registerExists, 'get', '/api/v1/items/exists', {
      query: { imdbId: 'tt-alien' },
      usernameHash: 'user',
    });

    expect(suggestionsResponse.send).toHaveBeenCalledWith({
      suggestions: [{ label: 'Alien Movie', value: 'tt-alien', kind: 'title' }],
    });
    expect(tagSuggestionsResponse.send).toHaveBeenCalledWith({
      suggestions: [{ label: '#space', value: '#space', kind: 'tag' }],
    });
    expect(favoriteSuggestionsResponse.send).toHaveBeenCalledWith({ suggestions: [] });
    expect(watchedSuggestionsResponse.send).toHaveBeenCalledWith({ suggestions: [] });
    expect(unwatchedSuggestionsResponse.send).toHaveBeenCalledWith({ suggestions: [] });
    expect(existsResponse.send).toHaveBeenCalledWith({ exists: true, hash: 'tt-alien-hash' });
  });

  it('returns search suggestions for the requested list type', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-library', title: 'Shared Title' });
    insertItem({ imdbId: 'tt-watch-later', title: 'Shared Title', listType: 'watch-later', tags: ['#queued'] });
    const { register } = await import('./collection-items-search-suggestions-api');

    const titleResponse = await callRoute(register, 'get', '/api/v1/items/search-suggestions', {
      query: { query: 'shared', limit: '5', listType: 'watch-later' },
      usernameHash: 'user',
    });
    const tagResponse = await callRoute(register, 'get', '/api/v1/items/search-suggestions', {
      query: { query: '#que', limit: '5', listType: 'watch-later' },
      usernameHash: 'user',
    });

    expect(titleResponse.send).toHaveBeenCalledWith({
      suggestions: [{ label: 'Shared Title', value: 'tt-watch-later', kind: 'title' }],
    });
    expect(tagResponse.send).toHaveBeenCalledWith({
      suggestions: [{ label: '#queued', value: '#queued', kind: 'tag' }],
    });
  });

  it('returns tag suggestions including former internal tag names', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-one', title: 'One', tags: ['#movie', '#favorite', '#space'] });
    const { register } = await import('./tag-suggestions-api');

    const response = await callRoute(register, 'get', '/api/v1/tags/suggestions', {
      query: { query: '#', limit: '10' },
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith({ tags: ['#favorite', '#movie', '#space'] });
  });

  it('returns genre suggestions', async () => {
    insertUser();
    insertItem({ imdbId: 'tt-one', title: 'One', genres: ['Sci-Fi', 'Drama'] });
    const { register } = await import('./genre-suggestions-api');

    const response = await callRoute(register, 'get', '/api/v1/genres/suggestions', {
      query: { query: 'sci', limit: '10' },
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith({ genres: ['Sci-Fi'] });
  });

  it('returns statistics with semantic tag counts and custom tag counts', async () => {
    insertUser();
    insertItem({
      imdbId: 'tt-movie',
      title: 'Movie',
      tags: ['#movie', '#favorite', '#space'],
      genres: ['Sci-Fi'],
      favorite: true,
    });
    insertItem({ imdbId: 'tt-movie', title: 'Movie', tags: ['#movie'], listType: 'movie-tracker' });
    insertItem({
      imdbId: 'tt-series',
      title: 'Series',
      tags: ['#series', '#drama'],
      genres: ['Drama'],
      contentType: 'series',
    });
    const { register } = await import('./statistics-api');

    const response = await callRoute(register, 'get', '/api/v1/statistics', {
      query: {},
      usernameHash: 'user',
    });

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 2,
        movieCount: 1,
        seriesCount: 1,
        favoriteCount: 1,
        watchLaterCount: 0,
        wishlistCount: 0,
        watchedMovieCount: 1,
        watchedSeriesCount: 0,
        unwatchedMovieCount: 0,
        unwatchedLibrarySeriesCount: 1,
        unwatchedTrackerSeriesCount: 0,
        completedTrackerSeriesCount: 0,
        watchedYearCounts: [],
        tagCounts: [
          { tag: '#drama', count: 1 },
          { tag: '#favorite', count: 1 },
          { tag: '#movie', count: 1 },
          { tag: '#series', count: 1 },
          { tag: '#space', count: 1 },
        ],
        genreCounts: [
          { genre: 'Drama', count: 1 },
          { genre: 'Sci-Fi', count: 1 },
        ],
      })
    );
  });
});
