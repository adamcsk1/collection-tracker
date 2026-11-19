import fastifyCookie from '@fastify/cookie';
import fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { jwtGuard } from '../core/jwt';
import { getVisionAvailability } from '../core/ollama/ollama-vision';
import { apiResponseHook } from '../core/utils/api-response-util';
import { register } from './photo-import-availability-api';

vi.mock('../core/ollama/ollama-vision', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/ollama/ollama-vision')>()),
  getVisionAvailability: vi.fn(),
}));

describe('photo-import-availability-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { available: true, reason: 'available' as const },
    { available: false, reason: 'not-configured' as const },
    { available: false, reason: 'invalid-config' as const },
    { available: false, reason: 'unsupported-model' as const },
    { available: false, reason: 'unreachable' as const },
  ])('returns independent vision availability %j behind the JWT guard', async (availability) => {
    vi.mocked(getVisionAvailability).mockResolvedValueOnce(availability);
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user' }, response);
    register(app);

    await handlerPromise();

    expect(app.get).toHaveBeenCalledWith(
      '/api/v1/ai/vision/availability',
      { preHandler: jwtGuard },
      expect.any(Function)
    );
    expect(response.send).toHaveBeenCalledWith(availability);
  });

  it('rejects unauthenticated requests with a problem response without probing Ollama', async () => {
    const app = fastify();
    app.addHook('onSend', apiResponseHook);
    await app.register(fastifyCookie);
    register(app);
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/ai/vision/availability' });

      expect(response.statusCode).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toMatchObject({
        status: 401,
        code: 'HTTP_401',
        instance: '/api/v1/ai/vision/availability',
      });
      expect(getVisionAvailability).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
