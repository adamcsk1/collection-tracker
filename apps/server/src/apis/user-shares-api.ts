import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findIncomingShares, findOutgoingShares } from '../core/database/repositories/share-repository';
import { findUserByShareCode, getUserShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/user/shares`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const db = getDatabase();
      const outgoing = findOutgoingShares(db, request.usernameHash);
      const incoming = findIncomingShares(db, request.usernameHash);

      response.send({
        userShareCode: getUserShareCode(request.usernameHash),
        outgoing: outgoing.map((row) => ({
          sharedWithUserShareCode: getUserShareCode(row.shared_with_username_hash),
          sharedWithUsername:
            findUserByShareCode(db, getUserShareCode(row.shared_with_username_hash))?.username ?? null,
          canRead: row.can_read === 1,
          canCreate: row.can_create === 1,
          canUpdate: row.can_update === 1,
          canDelete: row.can_delete === 1,
        })),
        incoming: incoming.map((row) => ({
          ownerUserShareCode: getUserShareCode(row.owner_username_hash),
          ownerUsername: findUserByShareCode(db, getUserShareCode(row.owner_username_hash))?.username ?? null,
          canRead: row.can_read === 1,
          canCreate: row.can_create === 1,
          canUpdate: row.can_update === 1,
          canDelete: row.can_delete === 1,
        })),
      });
    })
  );
};
