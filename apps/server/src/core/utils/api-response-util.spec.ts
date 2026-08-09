import fastifyRateLimit from '@fastify/rate-limit';
import { API_PREFIX } from '@shared/constants/api-const';
import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { apiResponseHook } from './api-response-util';

const buildApp = () => {
  const app = fastify();
  app.addHook('onSend', apiResponseHook);
  return app;
};

describe('apiResponseHook', () => {
  it.each([
    ['object', { value: 1 }],
    ['array', [{ value: 1 }]],
  ])('wraps an API JSON %s response', async (_description, body) => {
    const app = buildApp();
    app.get(`${API_PREFIX}/test`, async () => body);

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: body });
    } finally {
      await app.close();
    }
  });

  it('wraps a domain object containing data exactly once', async () => {
    const app = buildApp();
    app.get(`${API_PREFIX}/test`, async () => ({ data: ['domain value'] }));

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.json()).toEqual({ data: { data: ['domain value'] } });
    } finally {
      await app.close();
    }
  });

  it('wraps a domain object containing items and page normally', async () => {
    const app = buildApp();
    const page = { limit: 2, hasMore: true, nextCursor: 'cursor' };
    app.get(`${API_PREFIX}/test`, async () => ({ items: [{ id: 1 }, { id: 2 }], page }));

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.json()).toEqual({ data: { items: [{ id: 1 }, { id: 2 }], page } });
    } finally {
      await app.close();
    }
  });

  it('leaves a canonical cursor page exact', async () => {
    const app = buildApp();
    const body = {
      data: [{ id: 1 }, { id: 2 }],
      page: { limit: 2, hasMore: true, nextCursor: 'cursor' },
    };
    app.get(`${API_PREFIX}/test`, async () => body);

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.json()).toEqual(body);
    } finally {
      await app.close();
    }
  });

  it('does not treat an inconsistent cursor page as a wire envelope', async () => {
    const app = buildApp();
    const body = { data: [{ id: 1 }], page: { limit: 1, hasMore: true, nextCursor: null } };
    app.get(`${API_PREFIX}/test`, async () => body);

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.json()).toEqual({ data: body });
    } finally {
      await app.close();
    }
  });

  it('leaves no-content and binary API responses unchanged', async () => {
    const app = buildApp();
    app.get(`${API_PREFIX}/empty`, async (_request, response) => response.code(204).send());
    app.get(`${API_PREFIX}/binary`, async (_request, response) =>
      response.type('application/octet-stream').send(Buffer.from([1, 2, 3]))
    );

    try {
      const emptyResponse = await app.inject({ method: 'GET', url: `${API_PREFIX}/empty` });
      const binaryResponse = await app.inject({ method: 'GET', url: `${API_PREFIX}/binary` });

      expect(emptyResponse.statusCode).toBe(204);
      expect(emptyResponse.body).toBe('');
      expect(binaryResponse.rawPayload).toEqual(Buffer.from([1, 2, 3]));
    } finally {
      await app.close();
    }
  });

  it('leaves non-API JSON responses unchanged', async () => {
    const app = buildApp();
    app.get('/test', async () => ({ value: 1 }));

    try {
      const response = await app.inject({ method: 'GET', url: '/test' });

      expect(response.json()).toEqual({ value: 1 });
    } finally {
      await app.close();
    }
  });

  it('converts API errors to Problem Details and preserves safe detail', async () => {
    const app = buildApp();
    app.get(`${API_PREFIX}/test`, async (_request, response) => response.code(400).send({ error: 'Invalid value' }));

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test?value=bad` });

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'HTTP_400',
        detail: 'Invalid value',
        instance: `${API_PREFIX}/test`,
      });
    } finally {
      await app.close();
    }
  });

  it('does not expose internal server error details', async () => {
    const app = buildApp();
    app.get(`${API_PREFIX}/test`, async (_request, response) =>
      response.code(500).send({ message: 'database password leaked' })
    );

    try {
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/test` });

      expect(response.json()).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'HTTP_500',
        instance: `${API_PREFIX}/test`,
      });
    } finally {
      await app.close();
    }
  });

  it('converts rate-limit responses registered after the hook', async () => {
    const app = buildApp();
    await app.register(fastifyRateLimit, { max: 1, timeWindow: '1 minute' });
    app.get(`${API_PREFIX}/limited`, async () => ({ ok: true }));

    try {
      await app.inject({ method: 'GET', url: `${API_PREFIX}/limited` });
      const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/limited` });

      expect(response.statusCode).toBe(429);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBe('1');
      expect(response.json()).toMatchObject({
        title: 'Too Many Requests',
        status: 429,
        code: 'HTTP_429',
        instance: `${API_PREFIX}/limited`,
      });
    } finally {
      await app.close();
    }
  });
});
