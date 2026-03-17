import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { readdir, readFile, stat } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/anthropic', () => ({ createAnthropicClient: vi.fn(), getAnthropicModel: vi.fn() }));
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, readdir: vi.fn(), readFile: vi.fn(), stat: vi.fn() };
});

describe('proxy-claude-api', () => {
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
    const { createAnthropicClient } = await import('@server/core/anthropic');
    vi.mocked(createAnthropicClient).mockReturnValue({
      messages: {
        stream: vi.fn().mockReturnValue({
          finalMessage: vi.fn().mockResolvedValue({ stop_reason, content: [{ type: 'text', text }] }),
        }),
      },
    } as any);
  };

  const setupStore = (files: { name: string; content: string }[]) => {
    const cache: Record<string, string> = {};
    (Store.getLastValue as Mock).mockImplementation((key: string) => {
      if (key === 'dataFolder') return '/data';
      if (key === 'cache') return cache;
      if (key === 'parserConfigs') return {};
      return null;
    });
    (Store.set as Mock).mockImplementation((_key: string, value: any) => value);
    (readdir as Mock).mockResolvedValue(files.map((f) => f.name));
    (stat as Mock).mockResolvedValue({ birthtimeMs: 1000 });
    (readFile as Mock).mockImplementation((filePath: string) => {
      const name = filePath.split('/').pop()!;
      return Promise.resolve(files.find((f) => f.name === name)?.content ?? '');
    });
  };

  const matrixContent = `### The Matrix
[IMDb (tt0133093)](https://www.imdb.com/title/tt0133093/) (**8.7** / 10)
A computer hacker learns about the true nature of reality.`;

  const batmanContent = `### Batman Begins
[IMDb (tt0372784)](https://www.imdb.com/title/tt0372784/) (**8.2** / 10)
The origin story of Batman.`;

  const request = (prompt: string): any => ({
    body: { prompt },
    usernameHash: 'user',
  });

  describe('POST /proxy/claude/query', () => {
    it('returns matched IMDB IDs from Claude response', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupStore([
        { name: 'matrix.md', content: matrixContent },
        { name: 'batman.md', content: batmanContent },
      ]);
      await mockStream('["tt0133093"]');

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('filters out hallucinated IDs not in the collection', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupStore([{ name: 'matrix.md', content: matrixContent }]);
      await mockStream('["tt0133093", "tt9999999"]');

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: ['tt0133093'] });
    });

    it('returns empty matchedIds for an empty collection', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi movies?'), response);
      setupStore([]);

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.send).toHaveBeenCalledWith({ matchedIds: [] });
    });

    it('returns 503 when CLAUDE_API_KEY is not set', async () => {
      delete process.env.CLAUDE_API_KEY;
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.send).toHaveBeenCalledWith({ error: 'Claude API key not configured' });
    });

    it('returns 400 on invalid request body (empty prompt)', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ body: { prompt: '' }, usernameHash: 'user' }, response);

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith({ error: 'Invalid request body' });
    });

    it('returns 502 when Claude returns non-JSON', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupStore([{ name: 'matrix.md', content: matrixContent }]);
      await mockStream('not valid json');

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(502);
    });

    it('returns 502 when Claude response is truncated', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupStore([{ name: 'matrix.md', content: matrixContent }]);
      await mockStream('["tt0133093"]', 'max_tokens');

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(502);
    });

    it('returns 500 on unexpected error', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(request('Which are sci-fi?'), response);
      setupStore([{ name: 'matrix.md', content: matrixContent }]);

      const { createAnthropicClient } = await import('@server/core/anthropic');
      vi.mocked(createAnthropicClient).mockReturnValue({
        messages: {
          stream: vi.fn().mockReturnValue({
            finalMessage: vi.fn().mockRejectedValue(new Error('network error')),
          }),
        },
      } as any);

      const { register } = await import('./proxy-claude-api');
      register(app);

      await handlerPromise();
      expect(response.sendStatus).toHaveBeenCalledWith(500);
    });
  });
});
