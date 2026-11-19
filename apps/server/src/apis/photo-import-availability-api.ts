import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { jwtGuard } from '../core/jwt';
import { getVisionAvailability } from '../core/ollama/ollama-vision';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/ai/vision/availability`,
    { preHandler: jwtGuard },
    withErrorHandler(async (_request, response) => {
      response.send(await getVisionAvailability());
    })
  );
};
