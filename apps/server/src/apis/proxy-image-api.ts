import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { fetchAndCacheImageWithDetails, getCachedImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/proxy/image`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const sourceUrl = String(request.query.url ?? '');

      const cached = getCachedImage(sourceUrl);
      if (cached) {
        response.setHeader('Content-Type', cached.contentType);
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.send(cached.buffer);
        return;
      }

      const result = await fetchAndCacheImageWithDetails(sourceUrl);

      switch (result.kind) {
        case 'fetched': {
          const refreshed = getCachedImage(sourceUrl);
          if (refreshed) {
            response.setHeader('Content-Type', refreshed.contentType);
            response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            response.send(refreshed.buffer);
          } else {
            response.sendStatus(400);
          }
          return;
        }
        case 'invalid-url':
        case 'blocked':
        case 'redirect':
          response.sendStatus(400);
          return;
        case 'upstream-error':
          response.sendStatus(result.statusCode);
          return;
        case 'not-image':
          response.sendStatus(415);
          return;
        case 'too-large':
          response.sendStatus(413);
          return;
      }
    })
  );
};
