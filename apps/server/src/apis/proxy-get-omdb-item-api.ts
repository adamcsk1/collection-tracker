import { OMDB_API } from '../core/constants/omdb-const';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/omdb/item`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const apiKey = process.env.OMDB_API_KEY;
      if (!apiKey) {
        response.code(503).send();
        return;
      }

      const url = new URL(OMDB_API);
      url.searchParams.append('i', String((request.query as Record<string, unknown>).i ?? ''));
      url.searchParams.append('apikey', apiKey);

      const result = await fetch(url.href);
      response.send((await result.json()) as OMDbResponseItemModel);
    })
  );
};
