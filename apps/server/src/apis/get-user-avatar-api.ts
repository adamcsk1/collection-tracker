import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserAvatar } from '../core/database/repositories/user-profile-repository';
import { hasUserShareRelationship } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/users/:shareCode/avatar`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      response.header('Cache-Control', 'private, no-store');
      const { shareCode } = request.params as { shareCode: string };
      const db = getDatabase();
      const user = findUserByShareCode(db, shareCode);
      if (
        !user ||
        (user.username_hash !== request.usernameHash &&
          !hasUserShareRelationship(db, user.username_hash, request.usernameHash) &&
          !hasUserShareRelationship(db, request.usernameHash, user.username_hash))
      ) {
        return response.code(404).send();
      }
      const avatar = findUserAvatar(db, user.username_hash);
      if (!avatar) return response.code(404).send();
      response.type('image/webp').send(avatar);
    })
  );
};
