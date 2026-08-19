import fastifyRateLimit from '@fastify/rate-limit';
import { API_PREFIX } from '@shared/constants/api-const';
import fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { HEALTH_RATE_LIMIT_GROUP_ID, IMAGE_RATE_LIMIT_GROUP_ID } from '../constants/rate-limit-const';
import {
  getAuthRateLimit,
  getGlobalRateLimit,
  getGroupedRateLimitHook,
  getHealthRateLimit,
  getImageRateLimit,
  getRefreshRateLimit,
} from './rate-limit-util';

describe('rate-limit-util', () => {
  afterEach(() => {
    delete process.env.AUTH_RATE_LIMIT;
    delete process.env.RATE_LIMIT;
    delete process.env.REFRESH_RATE_LIMIT;
    delete process.env.HEALTH_RATE_LIMIT;
    delete process.env.IMAGE_RATE_LIMIT;
  });

  it('uses a secure authentication limit by default', () => {
    delete process.env.AUTH_RATE_LIMIT;
    expect(getAuthRateLimit()).toBe(10);
  });

  it('validates the global rate limit', () => {
    expect(getGlobalRateLimit()).toBe(120);
    process.env.RATE_LIMIT = '500';
    expect(getGlobalRateLimit()).toBe(500);
    process.env.RATE_LIMIT = 'invalid';
    expect(getGlobalRateLimit()).toBe(120);
  });

  it('uses a configured authentication limit', () => {
    process.env.AUTH_RATE_LIMIT = '10000';
    expect(getAuthRateLimit()).toBe(10000);
  });

  it('uses a higher refresh limit by default', () => {
    delete process.env.REFRESH_RATE_LIMIT;
    expect(getRefreshRateLimit()).toBe(60);
  });

  it('uses a configured refresh limit', () => {
    process.env.REFRESH_RATE_LIMIT = '10000';
    expect(getRefreshRateLimit()).toBe(10000);
  });

  it.each([
    ['HEALTH_RATE_LIMIT', getHealthRateLimit, 60],
    ['IMAGE_RATE_LIMIT', getImageRateLimit, 240],
  ] as const)('uses default and configured %s values', (environmentName, getLimit, defaultLimit) => {
    expect(getLimit()).toBe(defaultLimit);
    process.env[environmentName] = '123';
    expect(getLimit()).toBe(123);
    process.env[environmentName] = 'invalid';
    expect(getLimit()).toBe(defaultLimit);
  });

  it.each(['invalid', '', ' ', '0', '0.5', '1.5', '-1'])(
    'uses the secure default for invalid authentication limit %s',
    (value) => {
      process.env.AUTH_RATE_LIMIT = value;
      expect(getAuthRateLimit()).toBe(10);
    }
  );

  it.each(['invalid', '', ' ', '0', '0.5', '1.5', '-1'])(
    'uses the secure default for invalid refresh limit %s',
    (value) => {
      process.env.REFRESH_RATE_LIMIT = value;
      expect(getRefreshRateLimit()).toBe(60);
    }
  );

  it.each([
    [`${API_PREFIX}/auth/sign-in`, getAuthRateLimit, 10],
    [`${API_PREFIX}/auth/sign-up`, getAuthRateLimit, 10],
    [`${API_PREFIX}/auth/session/refresh`, getRefreshRateLimit, 60],
  ] as const)('does not exempt %s from its endpoint limit', async (path, getLimit, expectedLimit) => {
    const app = fastify();
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
    app.post(path, { config: { rateLimit: { max: getLimit(), timeWindow: '1 minute' } } }, async (_request, response) =>
      response.code(204).send()
    );

    try {
      for (let requestNumber = 1; requestNumber <= expectedLimit; requestNumber += 1) {
        const response = await app.inject({ method: 'POST', url: path });
        expect(response.statusCode).toBe(204);
      }

      const limitedResponse = await app.inject({ method: 'POST', url: path });
      expect(limitedResponse.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('shares grouped health capacity while isolating image and normal API budgets', async () => {
    const app = fastify();
    await app.register(fastifyRateLimit, { max: 2, timeWindow: '1 minute' });
    const healthRateLimit = getGroupedRateLimitHook(app, HEALTH_RATE_LIMIT_GROUP_ID, 2);
    const imageRateLimit = getGroupedRateLimitHook(app, IMAGE_RATE_LIMIT_GROUP_ID, 2);
    const groupedConfig = (groupId: string) => ({ max: 2, timeWindow: '1 minute', groupId });

    app.get(
      '/health',
      { preHandler: healthRateLimit, config: { rateLimit: groupedConfig(HEALTH_RATE_LIMIT_GROUP_ID) } },
      async () => 'health'
    );
    app.get(
      '/health/details',
      { preHandler: healthRateLimit, config: { rateLimit: groupedConfig(HEALTH_RATE_LIMIT_GROUP_ID) } },
      async () => 'details'
    );
    app.get(
      '/image',
      { preHandler: imageRateLimit, config: { rateLimit: groupedConfig(IMAGE_RATE_LIMIT_GROUP_ID) } },
      async () => 'image'
    );
    app.get('/normal', async () => 'normal');

    try {
      expect((await app.inject('/health')).statusCode).toBe(200);
      expect((await app.inject('/health/details')).statusCode).toBe(200);
      const limitedHealthResponse = await app.inject('/health');
      expect(limitedHealthResponse.statusCode).toBe(429);
      expect(Number(limitedHealthResponse.headers['retry-after'])).toBeGreaterThan(0);

      expect((await app.inject('/image')).statusCode).toBe(200);
      expect((await app.inject('/image')).statusCode).toBe(200);
      expect((await app.inject('/image')).statusCode).toBe(429);

      expect((await app.inject('/normal')).statusCode).toBe(200);
      expect((await app.inject('/normal')).statusCode).toBe(200);
      expect((await app.inject('/normal')).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });
});
