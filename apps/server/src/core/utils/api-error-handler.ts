import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorLog } from '../logger';
import { getRequestPath } from './request-url-util';

export const withErrorHandler =
  (handler: (request: FastifyRequest, response: FastifyReply) => unknown) =>
  async (request: FastifyRequest, response: FastifyReply): Promise<void> => {
    try {
      await handler(request, response);
    } catch (error: unknown) {
      if (error instanceof Error) {
        await errorLog(
          `Unknown error at ${request.method} ${getRequestPath(request.url)} (${error.stack ?? error.message})`
        );
      }
      response.code(500).send();
    }
  };
