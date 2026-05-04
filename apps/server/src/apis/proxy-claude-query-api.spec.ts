import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/anthropic', () => ({ createAnthropicClient: vi.fn(), getAnthropicModel: vi.fn() }));

describe('proxy-claude-query-api', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
  });

  const mockStream = async (text: string, stop_reason = 'end_turn') => {
    const { createAnthropicClient } = await import('../core/anthropic');
    const stream = vi.fn().mockReturnValue({
      finalMessage: vi.fn().mockResolvedValue({ stop_reason, content: [{ type: 'text', text }] }),
    });
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: {
        stream,
      },
    } as any);
    return stream;
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

  describe('POST /proxy/claude/query', () => {
    it('returns matched IMDB IDs from Claude response', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
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
      await mockStream('["tt0133093"]');

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('includes structured metadata in the Claude prompt', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
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
      const stream = await mockStream('[]');

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      const payload = stream.mock.calls[0][0];
      expect(payload.messages[0].content).toContain('"genre":["Action","Sci-Fi"]');
      expect(payload.messages[0].content).toContain('"tags":["#family","#watched"]');
      expect(payload.messages[0].content).toContain('"actors":"Keanu Reeves, Carrie-Anne Moss"');
    });

    it('filters out hallucinated IDs not in the collection', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockStream('["tt0133093", "tt9999999"]');

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('returns empty matchedIds for an empty collection', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupCollection([]);

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: [] });
    });

    it('returns 503 when CLAUDE_API_KEY is not set', async () => {
      delete process.env.CLAUDE_API_KEY;
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.send).toHaveBeenCalledWith({ error: 'Claude API key not configured' });
    });

    it('returns 400 on invalid request body (empty prompt)', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ body: { prompt: '' }, usernameHash: 'user' }, response);

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    it('returns 502 when Claude returns non-JSON', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockStream('not valid json');

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(502);
    });

    it('returns 502 when Claude response is truncated', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);
      await mockStream('["tt0133093"]', 'max_tokens');

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(502);
    });

    it('returns 500 on unexpected error', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupCollection([
        {
          imdbId: 'tt0133093',
          title: 'The Matrix',
          plot: 'A computer hacker learns about the true nature of reality.',
        },
      ]);

      const { createAnthropicClient } = await import('../core/anthropic');
      vi.mocked(createAnthropicClient).mockReturnValue({
        messages: {
          stream: vi.fn().mockReturnValue({
            finalMessage: vi.fn().mockRejectedValue(new Error('network error')),
          }),
        },
      } as any);

      const { register } = await import('./proxy-claude-query-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(500);
    });
  });
});
