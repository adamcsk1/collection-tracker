import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserProfile, updateUserDisplayName } from '../core/database/repositories/user-profile-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseUserDisplayName } from '../core/utils/user-profile-util';

export const register = (app: FastifyInstance): void => {
  app.patch(
    `${API_PREFIX}/users/me/profile`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body;
      if (
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'displayName')
      ) {
        return response.code(400).send();
      }
      const displayName = parseUserDisplayName((body as Record<string, unknown>).displayName);
      if (displayName === undefined) return response.code(400).send();
      const db = getDatabase();
      if (!findUserProfile(db, request.usernameHash)) return response.code(404).send();
      updateUserDisplayName(db, request.usernameHash, displayName);
      response.send(findUserProfile(db, request.usernameHash));
    })
  );
};
