import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import { PHOTO_IMPORT_MAX_BASE64_LENGTH } from '@shared/constants/photo-import-const';
import fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { hashText } from '../core/crypto';
import { getDatabase } from '../core/database/database';
import { generateAccessToken, jwtGuard } from '../core/jwt';
import { recognizePhoto, VisionError } from '../core/ollama/ollama-vision';
import { apiResponseHook } from '../core/utils/api-response-util';
import { register } from './photo-import-recognize-api';

vi.mock('../core/ollama/ollama-vision', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/ollama/ollama-vision')>()),
  recognizePhoto: vi.fn(),
}));

describe('photo-import-recognize-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['movie', 'series', 'book', 'album'] as const)(
    'recognizes exactly one %s media type',
    async (contentType) => {
      const body = { contentType, imageBase64: 'photo' };
      const result = { titles: [{ title: 'Dune', year: null, contributor: null }] };
      vi.mocked(recognizePhoto).mockResolvedValueOnce(result);
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ body, usernameHash: 'user' }, response);
      register(app);

      await handlerPromise();

      expect(recognizePhoto).toHaveBeenCalledWith(body);
      expect(response.send).toHaveBeenCalledWith(result);
      expect(app.post).toHaveBeenCalledWith(
        '/api/v1/ai/vision/recognize',
        {
          preHandler: jwtGuard,
          bodyLimit: PHOTO_IMPORT_MAX_BASE64_LENGTH + 1024,
          config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
        },
        expect.any(Function)
      );
    }
  );

  it.each([
    undefined,
    null,
    [],
    {},
    'photo',
    { contentType: 'game', imageBase64: 'photo' },
    { contentType: ['movie'], imageBase64: 'photo' },
    { contentType: 'movie' },
    { contentType: 'movie', imageBase64: 42 },
  ])('rejects invalid request body %j before recognition', async (body) => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ body }, response);
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(recognizePhoto).not.toHaveBeenCalled();
  });
});

describe('photo-import-recognize-api HTTP contract', () => {
  let app: FastifyInstance;
  let authorization: string;
  const url = '/api/v1/ai/vision/recognize';
  const payload = { contentType: 'movie', imageBase64: 'photo' };

  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'vision-test-jwt-secret');
    vi.stubEnv('SALT', 'vision-test-salt');
    const token = await generateAccessToken('vision-user');
    const usernameHash = hashText('vision-user');
    const database = getDatabase();
    database.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
    database
      .prepare(
        'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(usernameHash, hashText(token), 'now', 'vision-test', null);
    authorization = `Bearer ${token}`;
    app = fastify();
    app.addHook('onSend', apiResponseHook);
    await app.register(fastifyCookie);
    await app.register(fastifyRateLimit, { max: 120, timeWindow: '1 minute' });
    register(app);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('envelopes successful recognition results', async () => {
    const result = { titles: [{ title: 'Dune', year: '2021', contributor: null }] };
    vi.mocked(recognizePhoto).mockResolvedValueOnce(result);
    const response = await app.inject({ method: 'POST', url, headers: { authorization }, payload });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: result });
  });

  it('requires authentication before recognition', async () => {
    const response = await app.inject({ method: 'POST', url, payload });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(recognizePhoto).not.toHaveBeenCalled();
  });

  it('returns invalid media types as RFC 9457 problems', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { authorization },
      payload: { ...payload, contentType: 'game' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'HTTP_400',
      instance: url,
    });
    expect(recognizePhoto).not.toHaveBeenCalled();
  });

  it.each([400, 413, 429, 502, 503, 504])(
    'preserves vision error status %s and detail in problem responses',
    async (statusCode) => {
      vi.mocked(recognizePhoto).mockRejectedValueOnce(new VisionError(statusCode, 'Vision failed.'));
      const response = await app.inject({ method: 'POST', url, headers: { authorization }, payload });

      expect(response.statusCode).toBe(statusCode);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toMatchObject({
        type: 'about:blank',
        status: statusCode,
        code: `HTTP_${statusCode}`,
        instance: url,
        detail: 'Vision failed.',
      });
    }
  );

  it('does not expose unexpected server error details', async () => {
    vi.mocked(recognizePhoto).mockRejectedValueOnce(new Error('private upstream data'));
    const response = await app.inject({ method: 'POST', url, headers: { authorization }, payload });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).not.toHaveProperty('detail');
    expect(response.body).not.toContain('private upstream data');
  });

  it('rejects requests above the route body limit before recognition', async () => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { authorization },
      payload: {
        ...payload,
        imageBase64: 'A'.repeat(PHOTO_IMPORT_MAX_BASE64_LENGTH + 1024),
      },
    });

    expect(response.statusCode).toBe(413);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(recognizePhoto).not.toHaveBeenCalled();
  });

  it('limits recognition to 20 requests per minute', async () => {
    vi.mocked(recognizePhoto).mockResolvedValue({ titles: [] });
    for (let requestIndex = 0; requestIndex < 20; requestIndex += 1) {
      const response = await app.inject({ method: 'POST', url, headers: { authorization }, payload });
      expect(response.statusCode).toBe(200);
    }
    const response = await app.inject({ method: 'POST', url, headers: { authorization }, payload });

    expect(response.statusCode).toBe(429);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.headers['retry-after']).toBeDefined();
    expect(recognizePhoto).toHaveBeenCalledTimes(20);
  });
});
