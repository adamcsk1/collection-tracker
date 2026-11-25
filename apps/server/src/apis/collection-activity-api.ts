import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { getCollectionActivity } from '../core/database/repositories/collection/collection-activity-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/activity`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      if (
        typeof query.year !== 'string' ||
        !/^[1-9]\d{3}$/.test(query.year) ||
        (query.type !== undefined && parseType(query.type) === undefined)
      )
        return response.code(400).send();
      response.send(
        getCollectionActivity(getDatabase(), request.usernameHash, Number(query.year), parseType(query.type))
      );
    })
  );
};
