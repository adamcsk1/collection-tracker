import { API_PREFIX } from '@shared/constants/api-const';
import { PHOTO_IMPORT_MAX_BASE64_LENGTH } from '@shared/constants/photo-import-const';
import type { FastifyInstance } from 'fastify';
import { jwtGuard } from '../core/jwt';
import { recognizePhoto, VisionError } from '../core/ollama/ollama-vision';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/ai/vision/recognize`,
    {
      preHandler: jwtGuard,
      bodyLimit: PHOTO_IMPORT_MAX_BASE64_LENGTH + 1024,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    withErrorHandler(async (request, response) => {
      const body = request.body;
      if (
        !body ||
        typeof body !== 'object' ||
        !('contentType' in body) ||
        !('imageBase64' in body) ||
        typeof body.imageBase64 !== 'string' ||
        !['movie', 'series', 'book', 'album'].includes(String(body.contentType))
      ) {
        return response.code(400).send({ error: 'Choose one media type and provide a photo.' });
      }
      const contentType = body.contentType;
      if (contentType !== 'movie' && contentType !== 'series' && contentType !== 'book' && contentType !== 'album') {
        return response.code(400).send();
      }
      try {
        response.send(await recognizePhoto({ contentType, imageBase64: body.imageBase64 }));
      } catch (error) {
        if (!(error instanceof VisionError)) throw error;
        response.code(error.statusCode).send({ error: error.message });
      }
    })
  );
};
