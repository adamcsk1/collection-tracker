import fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { debugLog, errorLog } from './logger';
import { registerRequestLogging } from './request-logging';

vi.mock('./logger', () => ({ debugLog: vi.fn(), errorLog: vi.fn() }));

describe('metadata request logging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs safe request failures and completion details without query strings or headers', async () => {
    const app = fastify();
    registerRequestLogging(app);
    app.get('/v1/:provider/search', async () => {
      throw new Error('Invalid API key!');
    });
    try {
      const response = await app.inject({
        url: '/v1/omdb/search?s=private-title',
        headers: { authorization: 'Bearer secret' },
      });
      expect(response.statusCode).toBe(500);
      expect(errorLog).toHaveBeenCalledOnce();
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('error=Invalid API key!'));
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('status=500 elapsedMs='));
      const logged = JSON.stringify([vi.mocked(errorLog).mock.calls, vi.mocked(debugLog).mock.calls]);
      expect(logged).toContain('requestId');
      expect(logged).toContain('omdb');
      expect(logged).not.toContain('private-title');
      expect(logged).not.toContain('secret');
    } finally {
      await app.close();
    }
  });

  it('logs successful and unmatched routes without failing requests', async () => {
    const app = fastify();
    registerRequestLogging(app);
    app.get('/health', async () => ({ data: {} }));
    try {
      expect((await app.inject('/health')).statusCode).toBe(200);
      expect((await app.inject('/unknown?secret=value')).statusCode).toBe(404);
      expect(errorLog).not.toHaveBeenCalled();
      expect(debugLog).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(vi.mocked(debugLog).mock.calls)).not.toContain('secret');
    } finally {
      await app.close();
    }
  });
});
