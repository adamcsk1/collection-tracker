import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { deleteUser } from '../core/database/repositories/user-repository';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/users/me`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      deleteUser(getDatabase(), request.usernameHash);

      response.code(204).send();
    })
  );
};
