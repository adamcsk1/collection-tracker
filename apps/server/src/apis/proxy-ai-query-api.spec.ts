import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';

vi.mock('../core/ollama', () => ({ createOllamaClient: vi.fn(), getOllamaModel: vi.fn(() => 'qwen2.5:3b') }));

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
      expect(payload.prompt).toContain('"genre":["Action","Sci-Fi"]');
      expect(payload.prompt).toContain('"tags":["#family","#watched"]');
      expect(payload.prompt).toContain('"actors":"Keanu Reeves, Carrie-Anne Moss"');
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

    it('returns 500 on unexpected error', async () => {
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
      expect(response.code).toHaveBeenCalledWith(500);
    });
  });
});
