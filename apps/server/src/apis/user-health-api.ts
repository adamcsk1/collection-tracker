import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getHealth } from '@server/core/health/health';
import { HEALTH_RATE_LIMIT_GROUP_ID } from '../core/constants/rate-limit-const';
import { jwtGuard } from '../core/jwt';
import { getGroupedRateLimitHook, getHealthRateLimit } from '../core/utils/rate-limit-util';

export const register = (app: FastifyInstance): void => {
  const rateLimit = getHealthRateLimit();
  app.get(
    `${API_PREFIX}/users/me/health`,
    {
      preHandler: [getGroupedRateLimitHook(app, HEALTH_RATE_LIMIT_GROUP_ID, rateLimit), jwtGuard],
      config: { rateLimit: { max: rateLimit, timeWindow: '1 minute', groupId: HEALTH_RATE_LIMIT_GROUP_ID } },
    },
    async (_request, response) => {
      response.send(await getHealth());
    }
  );
};
