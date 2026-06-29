import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { deleteShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.delete(
    `${API_PREFIX}/user/shares/:sharedWithUserShareCode`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { sharedWithUserShareCode } = request.params as Record<string, string>;
      if (typeof sharedWithUserShareCode !== 'string' || !sharedWithUserShareCode.trim()) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const sharedWithUser = findUserByShareCode(db, sharedWithUserShareCode.trim());
      if (!sharedWithUser) {
        return response.code(404).send();
      }

      deleteShare(db, request.usernameHash, sharedWithUser.username_hash);

      response.code(204).send();
    })
  );
};
