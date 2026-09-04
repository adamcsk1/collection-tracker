import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.get('/health', async (_request, response) => {
    response.send({ data: { status: 'ok' } });
  });
};
