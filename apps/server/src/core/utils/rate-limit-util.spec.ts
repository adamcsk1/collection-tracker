import fastifyRateLimit from '@fastify/rate-limit';
import { API_PREFIX } from '@shared/constants/api-const';
import fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { RATE_LIMIT_EXCLUDED_PATHS } from '../constants/rate-limit-const';
import { getAuthRateLimit, getRefreshRateLimit } from './rate-limit-util';

describe('rate-limit-util', () => {
  afterEach(() => {
    delete process.env.AUTH_RATE_LIMIT;
    delete process.env.REFRESH_RATE_LIMIT;
  });

  it('uses a secure authentication limit by default', () => {
    delete process.env.AUTH_RATE_LIMIT;
    expect(getAuthRateLimit()).toBe(10);
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
    [`${API_PREFIX}/sign-in`, getAuthRateLimit, 10],
    [`${API_PREFIX}/sign-up`, getAuthRateLimit, 10],
    [`${API_PREFIX}/session/refresh`, getRefreshRateLimit, 60],
  ] as const)('does not exempt %s from its endpoint limit', async (path, getLimit, expectedLimit) => {
    const app = fastify();
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      allowList: (request) => RATE_LIMIT_EXCLUDED_PATHS.includes(request.routeOptions.url ?? request.url),
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
});
