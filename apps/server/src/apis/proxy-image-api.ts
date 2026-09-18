import { API_PREFIX } from '@shared/constants/api-const';
import { isProxyImageVariant, type ProxyImageVariant } from '@shared/utils/proxy-image-url-util';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { IMAGE_RATE_LIMIT_GROUP_ID } from '../core/constants/rate-limit-const';
import { IMAGE_PROXY_QUEUE_TIMEOUT_MS } from '../core/image/image-proxy-const';
import { isBackgroundImageUrl } from '../core/background/background';
import { fetchAndCacheImageWithDetails, getCachedImage } from '../core/image/image-proxy';
import type { CachedImage } from '../core/image/image-proxy-model';
import { optionalJwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getGroupedRateLimitHook, getImageRateLimit } from '../core/utils/rate-limit-util';

const sendCachedImage = (response: FastifyReply, image: CachedImage, cachePublic: boolean): void => {
  response.header('Content-Type', image.contentType);
  response.header(
    'Cache-Control',
    image.fallback
      ? 'no-store'
      : cachePublic
        ? 'public, max-age=31536000, immutable'
        : 'private, max-age=31536000, immutable'
  );
  response.send(image.buffer);
};

const parseImageVariant = (rawVariant: unknown): ProxyImageVariant | undefined | false => {
  if (rawVariant == null || rawVariant === '') return undefined;
  return isProxyImageVariant(rawVariant) ? rawVariant : false;
};

export const register = (app: FastifyInstance): void => {
  const rateLimit = getImageRateLimit();
  app.get(
    `${API_PREFIX}/images/proxy`,
    {
      preHandler: [getGroupedRateLimitHook(app, IMAGE_RATE_LIMIT_GROUP_ID, rateLimit), optionalJwtGuard],
      config: { rateLimit: { max: rateLimit, timeWindow: '1 minute', groupId: IMAGE_RATE_LIMIT_GROUP_ID } },
    },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const sourceUrl = String(query.url ?? '');
      const variant = parseImageVariant(query.variant);
      if (variant === false) {
        response.code(400).send();
        return;
      }

      if (!request.usernameHash) {
        if (!isBackgroundImageUrl(sourceUrl)) {
          response.code(401).send();
          return;
        }

        const allowlisted = await getCachedImage(sourceUrl, variant);
        if (allowlisted) {
          sendCachedImage(response, allowlisted, true);
          return;
        }

        response.code(404).send();
        return;
      }

      const cached = await getCachedImage(sourceUrl, variant);
      if (cached) {
        sendCachedImage(response, cached, false);
        return;
      }

      const result = await fetchAndCacheImageWithDetails(sourceUrl);

      switch (result.kind) {
        case 'fetched':
        case 'cached': {
          const refreshed = await getCachedImage(sourceUrl, variant);
          if (refreshed) {
            sendCachedImage(response, refreshed, false);
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
