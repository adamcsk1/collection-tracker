import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findSharesForUser } from '../core/database/repositories/share-repository';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/user/shares`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const shares = findSharesForUser(db, request.usernameHash);

      response.send({
        userShareCode: getUserShareCode(request.usernameHash),
        outgoing: shares
          .filter((share) => share.direction === 'outgoing')
          .map((share) => ({
            sharedWithUserShareCode: getUserShareCode(share.sharedWithUsernameHash),
            sharedWithUsername: share.counterpartUsername,
            grants: share.grants,
          })),
        incoming: shares
          .filter((share) => share.direction === 'incoming')
          .map((share) => ({
            ownerUserShareCode: getUserShareCode(share.ownerUsernameHash),
            ownerUsername: share.counterpartUsername,
            grants: share.grants,
          })),
      });
    })
  );
};
