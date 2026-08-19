import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { IMAGE_RATE_LIMIT_GROUP_ID } from '../core/constants/rate-limit-const';
import { IMAGE_PROXY_QUEUE_TIMEOUT_MS } from '../core/image/image-proxy-const';
import { fetchAndCacheImageWithDetails, getCachedImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getGroupedRateLimitHook, getImageRateLimit } from '../core/utils/rate-limit-util';

export const register = (app: FastifyInstance): void => {
  const rateLimit = getImageRateLimit();
  app.get(
    `${API_PREFIX}/images/proxy`,
    {
      preHandler: [getGroupedRateLimitHook(app, IMAGE_RATE_LIMIT_GROUP_ID, rateLimit), jwtGuard],
      config: { rateLimit: { max: rateLimit, timeWindow: '1 minute', groupId: IMAGE_RATE_LIMIT_GROUP_ID } },
    },
    withErrorHandler(async (request, response) => {
      const sourceUrl = String((request.query as Record<string, unknown>).url ?? '');

      const cached = await getCachedImage(sourceUrl);
      if (cached) {
        response.header('Content-Type', cached.contentType);
        response.header('Cache-Control', 'public, max-age=31536000, immutable');
        response.send(cached.buffer);
        return;
      }

      const result = await fetchAndCacheImageWithDetails(sourceUrl);

      switch (result.kind) {
        case 'fetched':
        case 'cached': {
          const refreshed = await getCachedImage(sourceUrl);
          if (refreshed) {
            response.header('Content-Type', refreshed.contentType);
            response.header('Cache-Control', 'public, max-age=31536000, immutable');
            response.send(refreshed.buffer);
          } else {
            response.code(400).send();
          }
          return;
        }
        case 'invalid-url':
        case 'blocked':
        case 'redirect':
          response.code(400).send();
          return;
        case 'upstream-error':
          response.code(502).send();
          return;
        case 'not-image':
          response.code(415).send();
          return;
        case 'too-large':
          response.code(413).send();
          return;
        case 'busy':
          response.header('Retry-After', Math.ceil(IMAGE_PROXY_QUEUE_TIMEOUT_MS / 1000));
          response.code(503).send();
          return;
      }
    })
  );
};
