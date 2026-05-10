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
    vi.mocked(createOllamaClient).mockReturnValue({ generate });
    return generate;
  };

  const setupCollection = (
    files: { imdbId: string; title: string; plot: string; actors?: string; genre?: string[]; tags?: string[] }[]
  ) => {
    const db = getDatabase();
    db.prepare('INSERT OR IGNORE INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    for (const file of files) {
      const result = db
        .prepare(
          `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, actors, plot, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'user',
          file.imdbId,
          file.title,
          file.title.toLowerCase(),
          '',
          '',
          file.actors ?? '',
          file.plot,
          '',
          file.imdbId
        );
      const itemId = Number(result.lastInsertRowid);

      for (const genre of file.genre ?? []) {
        db.prepare('INSERT INTO collection_item_genres (item_id, genre) VALUES (?, ?)').run(itemId, genre);
      }

      for (const tag of file.tags ?? []) {
        db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
      }
    }
  };

  const request = (prompt: string): any => ({
    body: { prompt },
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
      await mockGenerate('["tt0133093"]');

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
          tags: ['#family', '#watched'],
        },
      ]);
      const generate = await mockGenerate('[]');

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      const payload = generate.mock.calls[0][0];
      expect(payload.system).toContain('You are a strict collection item filter for movies and series.');
      expect(payload.system).toContain('Return ONLY a valid JSON array of decision objects.');
      expect(payload.system).toContain('Each object must be shaped exactly like {"IMDbId":"tt0111161","match":true}.');
      expect(payload.system).toContain('Default to excluding an item.');
      expect(payload.system).toContain(
        'Do not mark every candidate as match:true unless every single candidate clearly matches the request.'
      );
      expect(payload.prompt).toContain('User search request:\nWhich are family sci-fi movies?');
      expect(payload.prompt).toContain('IMDbId:\ntt0133093');
      expect(payload.prompt).toContain('genre:\nAction,Sci-Fi');
      expect(payload.prompt).toContain('tags:\n#family,#watched');
      expect(payload.prompt).toContain('actors:\nKeanu Reeves, Carrie-Anne Moss');
      expect(payload.prompt).toContain('Candidate collection items:');
      expect(payload.prompt).toContain('Return the decision-object JSON array only.');
      expect(payload.options).toEqual({ num_predict: 128, temperature: 0, top_k: 10, num_thread: 4 });
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
      const generate = vi.fn().mockResolvedValue({ response: '[]', done: true, done_reason: 'stop' });
      vi.mocked(createOllamaClient).mockReturnValue({ generate });

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
        return { response: '[]', done: true, done_reason: 'stop' };
      });
      vi.mocked(createOllamaClient).mockReturnValue({ generate });

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
        return { response: '[]', done: true, done_reason: 'stop' };
      });
      vi.mocked(createOllamaClient).mockReturnValue({ generate });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(generate).toHaveBeenCalledTimes(3);
      expect(maxActiveRequests).toBe(2);
    });

    it('waits for active parallel batches before returning 502 after a batch failure', async () => {
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
      const generate = vi
        .fn()
        .mockResolvedValueOnce({ response: 'not valid json', done: true, done_reason: 'stop' })
        .mockReturnValueOnce(slowBatch);
      vi.mocked(createOllamaClient).mockReturnValue({ generate });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await Promise.resolve();
      expect(response.code).not.toHaveBeenCalled();

      resolveSlowBatch?.({ response: '[]', done: true, done_reason: 'stop' });
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
      await mockGenerate('["tt0133093", "tt9999999"]');

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
        .mockResolvedValueOnce({ response: '["tt0133093"]', done: true, done_reason: 'stop' })
        .mockResolvedValueOnce({ response: '[]', done: true, done_reason: 'stop' });
      vi.mocked(createOllamaClient).mockReturnValue({ generate });

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
      const { app, handlerPromise } = buildApp({ body: { prompt: '' }, usernameHash: 'user' }, response);

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    it('returns 502 when Ollama is unavailable', async () => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      const { validateOllamaConnection } = await import('../core/ollama/ollama');
      vi.mocked(validateOllamaConnection).mockRejectedValue(new Error('Ollama unavailable'));

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });

    it('returns 502 when AI returns non-JSON', async () => {
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
      });

      const { register } = await import('./proxy-ai-query-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(502);
    });
  });
});
