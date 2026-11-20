import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserProfile } from '../core/database/repositories/user-profile-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/users/me/profile`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const profile = findUserProfile(getDatabase(), request.usernameHash);
      if (!profile) return response.code(404).send();
      response.send(profile);
    })
  );
};
