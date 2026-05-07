import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { deleteAccessToken } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/user/access-token/:tokenHash`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const { tokenHash } = request.params as Record<string, string>;
      deleteAccessToken(getDatabase(), request.usernameHash, tokenHash as string);
      response.code(204).send();
    })
  );
};
