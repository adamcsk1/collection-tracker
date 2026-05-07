import { API_PREFIX } from '@shared/constants/api-const';
import { OMDbResponseModel } from '@shared/models/omdb-model';
import type { FastifyInstance } from 'fastify';
import { OMDB_API } from '../core/constants/omdb-const';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/omdb/search`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const apiKey = process.env.OMDB_API_KEY;
      if (!apiKey) {
        response.code(503).send();
        return;
      }

      if (typeof query.s !== 'string' || query.s.trim() === '') {
        response.code(400).send();
        return;
      }

      const url = new URL(OMDB_API);
      url.searchParams.append('s', query.s);
      url.searchParams.append('apikey', apiKey);

      const result = await fetch(url.href);
      response.send((await result.json()) as OMDbResponseModel);
    })
  );
};
