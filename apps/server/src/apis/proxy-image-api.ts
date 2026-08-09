import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { fetchAndCacheImageWithDetails, getCachedImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/image`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const sourceUrl = String((request.query as Record<string, unknown>).url ?? '');

      const cached = getCachedImage(sourceUrl);
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
          const refreshed = getCachedImage(sourceUrl);
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
          response.code(result.statusCode).send();
          return;
        case 'not-image':
          response.code(415).send();
          return;
        case 'too-large':
          response.code(413).send();
          return;
      }
    })
  );
};
