import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import {
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_HEALTH_RATE_LIMIT,
  DEFAULT_IMAGE_RATE_LIMIT,
  DEFAULT_RATE_LIMIT,
  DEFAULT_REFRESH_RATE_LIMIT,
} from '../constants/rate-limit-const';

const groupedRateLimitHooks = new WeakMap<FastifyInstance, Map<string, preHandlerAsyncHookHandler>>();

type RateLimitEnvironmentName =
  'RATE_LIMIT' | 'AUTH_RATE_LIMIT' | 'REFRESH_RATE_LIMIT' | 'HEALTH_RATE_LIMIT' | 'IMAGE_RATE_LIMIT';

const getRateLimit = (name: RateLimitEnvironmentName, defaultLimit: number): number => {
  const configuredLimit = Number(process.env[name]);
  return Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : defaultLimit;
};

export const getGlobalRateLimit = (): number => getRateLimit('RATE_LIMIT', DEFAULT_RATE_LIMIT);

export const getAuthRateLimit = (): number => getRateLimit('AUTH_RATE_LIMIT', DEFAULT_AUTH_RATE_LIMIT);

export const getRefreshRateLimit = (): number => getRateLimit('REFRESH_RATE_LIMIT', DEFAULT_REFRESH_RATE_LIMIT);

export const getHealthRateLimit = (): number => getRateLimit('HEALTH_RATE_LIMIT', DEFAULT_HEALTH_RATE_LIMIT);

export const getImageRateLimit = (): number => getRateLimit('IMAGE_RATE_LIMIT', DEFAULT_IMAGE_RATE_LIMIT);

export const getGroupedRateLimitHook = (
  app: FastifyInstance,
  groupId: string,
  max: number
): preHandlerAsyncHookHandler => {
  let hooks = groupedRateLimitHooks.get(app);
  if (!hooks) {
    hooks = new Map();
    groupedRateLimitHooks.set(app, hooks);
  }

  let hook = hooks.get(groupId);
  if (!hook) {
    const limiter = app.createRateLimit({
      max,
      timeWindow: '1 minute',
    });
    hook = async (request, response) => {
      const result = await limiter(request);
      if (result.isAllowed || !result.isExceeded) return;

      response.header('RateLimit-Limit', result.max);
      response.header('RateLimit-Remaining', result.remaining);
      response.header('RateLimit-Reset', result.ttlInSeconds);
      response.header('Retry-After', result.ttlInSeconds);
      response.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${result.ttlInSeconds} seconds`,
      });
    };
    hooks.set(groupId, hook);
  }
  return hook;
};
