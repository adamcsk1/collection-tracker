import { API_PREFIX } from '@shared/constants/api-const';
import type { AiAvailableApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { jwtGuard } from '../core/jwt';
import { validateOllamaConnection } from '../core/ollama/ollama';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/ai/available`,
    { preHandler: jwtGuard },
    withErrorHandler(async (_request, response) => {
      let aiAvailable = false;

      try {
        await validateOllamaConnection();
        aiAvailable = true;
      } catch {
        aiAvailable = false;
      }

      const result: AiAvailableApiResponseModel = { aiAvailable };
      response.send(result);
    })
  );
};
