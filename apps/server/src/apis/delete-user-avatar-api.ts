import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserProfile, updateUserAvatar } from '../core/database/repositories/user-profile-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/users/me/avatar`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      if (!findUserProfile(db, request.usernameHash)) return response.code(404).send();
      updateUserAvatar(db, request.usernameHash, null);
      response.send(findUserProfile(db, request.usernameHash));
    })
  );
};
