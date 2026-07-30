import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';

vi.mock('../core/ollama/ollama', () => ({
  createOllamaClient: vi.fn(),
  getOllamaConfig: vi.fn(() => ({
    host: 'http://127.0.0.1:11434',
    model: 'qwen2.5:3b',
    options: { temperature: 0, top_k: 10, num_thread: 4 },
    parallelRequests: 1,
  })),
  validateOllamaConnection: vi.fn(),
}));

describe('proxy-ai-query-api', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
  });

  const mockGenerate = async (text: string, doneReason = 'stop') => {
    const { createOllamaClient } = await import('../core/ollama/ollama');
    const generate = vi.fn().mockResolvedValue({ response: text, done: true, done_reason: doneReason });
    vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });
    return generate;
  };

  const mockEmbed = () =>
    vi.fn(async (payload: { input: string | string[] }) => {
      const inputs = Array.isArray(payload.input) ? payload.input : [payload.input];
      return { embeddings: inputs.map((_, index) => [1, index + 1]) };
    });

  const setupCollection = (
    files: {
      imdbId: string;
      title: string;
      plot: string;
      actors?: string;
      genre?: string[];
      tags?: string[];
      favorite?: boolean;
      rottenTomatoesRate?: string;
      metacriticRate?: string;
      listType?: string;
      usernameHash?: string;
      contentType?: string;
      watchedAt?: string | null;
      totalEpisodes?: number;
      watchedEpisodes?: number;
    }[]
  ) => {
    const db = getDatabase();
    db.prepare('INSERT OR IGNORE INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    for (const file of files) {
      const result = db
        .prepare(
          `INSERT INTO collection_items (username_hash, imdb_id, list_type, content_type, title, title_lower, favorite, year, rate, rotten_tomatoes_rate, metacritic_rate, actors, plot, image, content_hash, watched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          file.usernameHash ?? 'user',
          file.imdbId,
          file.listType ?? 'library',
          file.contentType ?? 'movie',
          file.title,
          file.title.toLowerCase(),
          file.favorite ? 1 : 0,
          '',
          '',
          file.rottenTomatoesRate ?? '',
          file.metacriticRate ?? '',
          file.actors ?? '',
          file.plot,
          '',
          file.imdbId,
          file.watchedAt === undefined ? null : file.watchedAt
        );
      const itemId = Number(result.lastInsertRowid);

      for (const genre of file.genre ?? []) {
        db.prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, genre);
      }

      for (const tag of file.tags ?? []) {
        db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
      }

      if (file.totalEpisodes) {
        db.prepare(
          'INSERT INTO series_tracker_seasons (item_id, season, episodes, episode_titles) VALUES (?, ?, ?, ?)'
        ).run(itemId, 1, file.totalEpisodes, '[]');
      }

      if (file.watchedEpisodes) {
        for (let episode = 1; episode <= file.watchedEpisodes; episode += 1) {
          db.prepare('INSERT INTO series_tracker_watched_episodes (item_id, season, episode) VALUES (?, ?, ?)').run(
            itemId,
            1,
            episode
          );
        }
      }
    }
  };

  const request = (prompt: string, listType = 'library'): any => ({
    body: { prompt, listType },
    usernameHash: 'user',
  });

  describe('POST /proxy/ai/query', () => {
    it('returns matched IMDB IDs from AI response', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
        {
          imdbId: 'tt0372784',
          title: 'Batman Begins',
          plot: 'The origin story of Batman.',
        },
      ]);
      await mockGenerate('{"matchedIds":["tt0133093"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('includes structured metadata in the AI prompt', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are family sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
          actors: 'Keanu Reeves, Carrie-Anne Moss',
          genre: ['Action', 'Sci-Fi'],
          tags: ['#family'],
          favorite: true,
          rottenTomatoesRate: '83%',
          metacriticRate: '73/100',
        },
      ]);
      const generate = await mockGenerate('{"matchedIds":[]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      const payload = generate.mock.calls[0][0];
      expect(payload.system).toContain('You are a strict movie and series collection search filter.');
      expect(payload.system).toContain(
        'Return ONLY valid JSON shaped exactly like {"matchedIds":["tt0111161","tt0068646"]}.'
      );
      expect(payload.system).toContain('If no candidates match, return {"matchedIds":[]}.');
      expect(payload.system).toContain('Default to excluding an item.');
      expect(payload.system).toContain('rottenTomatoesRate');
      expect(payload.system).toContain('metacriticRate');
      expect(payload.system).toContain('watchStatus');
      expect(payload.system).toContain('series-tracker: unfinished');
      expect(payload.system).toContain(
        'Do not mark every candidate as match:true unless every single candidate clearly matches the request.'
      );
      expect(payload.prompt).toContain('Active list: library');
      expect(payload.prompt).toContain('User search request:\nWhich are family sci-fi movies?');
      expect(payload.prompt).toContain('IMDbId:\ntt0133093');
      expect(payload.prompt).toContain('genre:\nAction,Sci-Fi');
      expect(payload.prompt).toContain('tags:\n#family');
      expect(payload.prompt).toContain('favorite:\ntrue');
      expect(payload.prompt).toContain('watchStatus:\nnot-applicable');
      expect(payload.prompt).toContain('rottenTomatoesRate:\n83%');
      expect(payload.prompt).toContain('metacriticRate:\n73/100');
      expect(payload.prompt).toContain('actors:\nKeanu Reeves, Carrie-Anne Moss');
      expect(payload.prompt).toContain('Candidate collection items:');
      expect(payload.prompt).toContain('Return the matchedIds JSON object only.');
      expect(payload.format).toEqual({
        type: 'object',
        properties: { matchedIds: { type: 'array', items: { type: 'string' } } },
        required: ['matchedIds'],
        additionalProperties: false,
      });
      expect(payload.options).toEqual({ num_predict: 64, temperature: 0, top_k: 10, num_thread: 4 });
    });

    it('returns unfinished series-tracker items without calling the LLM for pure status intents', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('unfinished series', 'series-tracker'), response);
      setupCollection([
        {
          imdbId: 'tt-unfinished',
          title: 'Ongoing Show',
          plot: 'A story about unfinished business.',
          listType: 'series-tracker',
          contentType: 'series',
          watchedAt: null,
          totalEpisodes: 10,
          watchedEpisodes: 3,
        },
        {
          imdbId: 'tt-finished',
          title: 'Finished Show',
          plot: 'A completed arc.',
          listType: 'series-tracker',
          contentType: 'series',
          watchedAt: '2024-01-01T00:00:00.000Z',
          totalEpisodes: 8,
          watchedEpisodes: 8,
        },
      ]);
      const generate = await mockGenerate('{"matchedIds":["tt-finished"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).not.toHaveBeenCalled();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt-unfinished'] });
    });

    it('serves pure status intents without requiring Ollama', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('favorites', 'library'), response);
      setupCollection([
        {
          imdbId: 'tt-fav',
          title: 'Favorite Movie',
          plot: 'A favorite film.',
          favorite: true,
        },
        {
          imdbId: 'tt-other',
          title: 'Other Movie',
          plot: 'Not favorite.',
        },
      ]);
      const { validateOllamaConnection } = await import('../core/ollama/ollama');
      const validateSpy = vi.mocked(validateOllamaConnection);
      validateSpy.mockRejectedValue(new Error('Ollama unavailable'));

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(validateSpy).not.toHaveBeenCalled();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt-fav'] });
      validateSpy.mockReset();
      validateSpy.mockResolvedValue(undefined);
    });

    it('does not prefilter library items for unfinished-looking thematic prompts', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('films about unfinished business', 'library'), response);
      setupCollection([
        {
          imdbId: 'tt-business',
          title: 'Unfinished Business',
          plot: 'A comedy about unfinished business.',
        },
      ]);
      const { validateOllamaConnection } = await import('../core/ollama/ollama');
      vi.mocked(validateOllamaConnection).mockResolvedValue(undefined);
      const generate = await mockGenerate('{"matchedIds":["tt-business"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate.mock.calls[0][0].prompt).toContain('tt-business');
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt-business'] });
    });

    it('prefilters unfinished candidates before LLM for mixed status queries', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('unfinished sci-fi series', 'series-tracker'), response);
      setupCollection([
        {
          imdbId: 'tt-unfinished-scifi',
          title: 'Space Drift',
          plot: 'A sci-fi journey.',
          listType: 'series-tracker',
          contentType: 'series',
          genre: ['Sci-Fi'],
          watchedAt: null,
          totalEpisodes: 10,
          watchedEpisodes: 2,
        },
        {
          imdbId: 'tt-finished-scifi',
          title: 'Space Done',
          plot: 'A finished sci-fi epic.',
          listType: 'series-tracker',
          contentType: 'series',
          genre: ['Sci-Fi'],
          watchedAt: '2024-02-01T00:00:00.000Z',
          totalEpisodes: 10,
          watchedEpisodes: 10,
        },
      ]);
      const generate = await mockGenerate('{"matchedIds":["tt-unfinished-scifi"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate.mock.calls[0][0].prompt).toContain('tt-unfinished-scifi');
      expect(generate.mock.calls[0][0].prompt).not.toContain('tt-finished-scifi');
      expect(generate.mock.calls[0][0].prompt).toContain('watchStatus:\nunfinished');
      expect(generate.mock.calls[0][0].prompt).toContain('Active list: series-tracker');
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt-unfinished-scifi'] });
    });

    it('passes configured keep_alive to Ollama', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are family sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      const { getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 1,
        keep_alive: '10m',
      });
      const generate = await mockGenerate('[]');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate.mock.calls[0][0]).toEqual(expect.objectContaining({ keep_alive: '10m' }));
    });

    it('sends all items in a single batch when batch size is not configured', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      const files = Array.from({ length: 15 }, (_, index) => ({
        imdbId: `tt${String(index).padStart(7, '0')}`,
        title: `Movie ${index}`,
        plot: 'A science fiction story.',
      }));
      setupCollection(files);

      const { createOllamaClient } = await import('../core/ollama/ollama');
      const generate = vi.fn().mockResolvedValue({ response: '{"matchedIds":[]}', done: true, done_reason: 'stop' });
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it('processes Ollama query batches sequentially when batch size is configured', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      const files = Array.from({ length: 15 }, (_, index) => ({
        imdbId: `tt${String(index).padStart(7, '0')}`,
        title: `Movie ${index}`,
        plot: 'A science fiction story.',
      }));
      setupCollection(files);

      const { createOllamaClient, getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 1,
        batchSize: 10,
      });

      let activeRequests = 0;
      let maxActiveRequests = 0;
      const generate = vi.fn(async () => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await Promise.resolve();
        activeRequests -= 1;
        return { response: '{"matchedIds":[]}', done: true, done_reason: 'stop' };
      });
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(2);
      expect(maxActiveRequests).toBe(1);
    });

    it('processes Ollama query batches in parallel when parallel requests are configured', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      const files = Array.from({ length: 15 }, (_, index) => ({
        imdbId: `tt${String(index).padStart(7, '0')}`,
        title: `Movie ${index}`,
        plot: 'A science fiction story.',
      }));
      setupCollection(files);

      const { createOllamaClient, getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 2,
        batchSize: 5,
      });

      let activeRequests = 0;
      let maxActiveRequests = 0;
      const generate = vi.fn(async () => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await Promise.resolve();
        activeRequests -= 1;
        return { response: '{"matchedIds":[]}', done: true, done_reason: 'stop' };
      });
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(3);
      expect(maxActiveRequests).toBe(2);
    });

    it('waits for active parallel batches before returning 502 after an Ollama request failure', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      const files = Array.from({ length: 3 }, (_, index) => ({
        imdbId: `tt${String(index).padStart(7, '0')}`,
        title: `Movie ${index}`,
        plot: 'A science fiction story.',
      }));
      setupCollection(files);

      const { createOllamaClient, getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 2,
        batchSize: 1,
      });

      let resolveSlowBatch: ((value: { response: string; done: boolean; done_reason: string }) => void) | undefined;
      const slowBatch = new Promise<{ response: string; done: boolean; done_reason: string }>((resolve) => {
        resolveSlowBatch = resolve;
      });
      const generate = vi.fn().mockRejectedValueOnce(new Error('network error')).mockReturnValueOnce(slowBatch);
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await Promise.resolve();
      expect(response.code).not.toHaveBeenCalled();

      resolveSlowBatch?.({ response: '{"matchedIds":[]}', done: true, done_reason: 'stop' });
      await handlerPromise();

      expect(generate).toHaveBeenCalledTimes(2);
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('filters out hallucinated IDs not in the collection', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockGenerate('{"matchedIds":["tt0133093", "tt9999999"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('returns IDs from AI decision objects marked as matches', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
        {
          imdbId: 'tt0372784',
          title: 'Batman Begins',
          plot: 'The origin story of Batman.',
        },
      ]);
      await mockGenerate('[{"IMDbId":"tt0133093","match":true},{"IMDbId":"tt0372784","match":false}]');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('returns IDs from malformed repeated object output', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are christmas movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0369436',
          title: 'Noel',
          plot: 'A Christmas story.',
        },
        {
          imdbId: 'tt8623904',
          title: 'A Christmas Carol',
          plot: 'A Christmas ghost story.',
        },
        {
          imdbId: 'tt2294629',
          title: 'Frozen',
          plot: 'Two sisters in a snowy kingdom.',
        },
      ]);
      await mockGenerate(`{
        "IMDbId": "tt0369436", "match": true,
        "IMDbId": "tt8623904", "match": true,
        "IMDbId": "tt2294629", "match": false
      }`);

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt8623904', 'tt0369436'] });
    });

    it('boosts exact lexical matches into the semantic candidate shortlist', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('matrix'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
        {
          imdbId: 'tt0372784',
          title: 'Batman Begins',
          plot: 'The origin story of Batman.',
        },
        {
          imdbId: 'tt0088763',
          title: 'Back to the Future',
          plot: 'A teenager travels through time.',
        },
      ]);

      const { createOllamaClient, getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 1,
        batchSize: 1,
        semanticCandidateLimit: 1,
      });
      const generate = vi.fn().mockResolvedValue({
        response: '{"matchedIds":["tt0133093"]}',
        done: true,
        done_reason: 'stop',
      });
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate.mock.calls[0][0].prompt).toContain('title:\nThe Matrix');
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('filters out IDs that were not present in the queried batch', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
        {
          imdbId: 'tt0372784',
          title: 'Batman Begins',
          plot: 'The origin story of Batman.',
        },
      ]);

      const { createOllamaClient, getOllamaConfig } = await import('../core/ollama/ollama');
      vi.mocked(getOllamaConfig).mockReturnValue({
        host: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        options: { temperature: 0, top_k: 10, num_thread: 4 },
        parallelRequests: 1,
        batchSize: 1,
      });
      const generate = vi
        .fn()
        .mockResolvedValueOnce({ response: '{"matchedIds":["tt0133093"]}', done: true, done_reason: 'stop' })
        .mockResolvedValueOnce({ response: '{"matchedIds":[]}', done: true, done_reason: 'stop' });
      vi.mocked(createOllamaClient).mockReturnValue({ generate, embed: mockEmbed() });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: [] });
    });

    it('returns empty matchedIds for an empty collection', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([]);

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: [] });
    });

    it('returns 400 on invalid request body (empty prompt)', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(
        { body: { prompt: '', listType: 'library' }, usernameHash: 'user' },
        response
      );

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    it('returns 400 when listType is missing or invalid', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ body: { prompt: 'sci-fi' }, usernameHash: 'user' }, response);

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    it('searches only items from the requested list type', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('sci-fi', 'watch-later'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
          listType: 'library',
        },
        {
          imdbId: 'tt0372784',
          title: 'Batman Begins',
          plot: 'The origin story of Batman.',
          listType: 'watch-later',
        },
      ]);
      const generate = await mockGenerate('{"matchedIds":["tt0372784"]}');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate.mock.calls[0][0].prompt).toContain('tt0372784');
      expect(generate.mock.calls[0][0].prompt).not.toContain('tt0133093');
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0372784'] });
    });

    it('returns 502 when Ollama is unavailable', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      const { validateOllamaConnection } = await import('../core/ollama/ollama');
      vi.mocked(validateOllamaConnection).mockRejectedValueOnce(new Error('Ollama unavailable'));

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('returns 502 when AI returns unparseable text', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockGenerate('not valid json');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('returns 502 when AI response is truncated', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockGenerate('["tt0133093"]', 'length');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('returns 502 when Ollama returns non-finite embeddings', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);

      const { createOllamaClient } = await import('../core/ollama/ollama');
      const generate = vi.fn();
      vi.mocked(createOllamaClient).mockReturnValue({
        generate,
        embed: vi.fn().mockResolvedValue({ embeddings: [[Number.NaN, 1]] }),
      });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
      expect(generate).not.toHaveBeenCalled();
    });

    it('returns 502 when Ollama returns item embeddings with the wrong dimension', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);

      const { createOllamaClient } = await import('../core/ollama/ollama');
      const generate = vi.fn();
      vi.mocked(createOllamaClient).mockReturnValue({
        generate,
        embed: vi
          .fn()
          .mockResolvedValueOnce({ embeddings: [[1, 2]] })
          .mockResolvedValueOnce({ embeddings: [[1]] }),
      });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
      expect(generate).not.toHaveBeenCalled();
    });

    it('returns 502 on unexpected AI service error', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);

      const { createOllamaClient } = await import('../core/ollama/ollama');
      vi.mocked(createOllamaClient).mockReturnValue({
        generate: vi.fn().mockRejectedValue(new Error('network error')),
        embed: mockEmbed(),
      });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });
  });
});
