import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  deleteShare,
  findIncomingShares,
  findOutgoingShares,
  upsertShare,
} from '../core/database/repositories/share-repository';
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

  app.post(
    `${API_PREFIX}/user/shares`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as {
        sharedWithUserShareCode?: string;
        canRead?: boolean;
        canCreate?: boolean;
        canUpdate?: boolean;
        canDelete?: boolean;
      };

      if (typeof body?.sharedWithUserShareCode !== 'string' || !body.sharedWithUserShareCode.trim()) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const sharedWithUser = findUserByShareCode(db, body.sharedWithUserShareCode.trim());
      if (!sharedWithUser || sharedWithUser.username_hash === request.usernameHash) {
        return response.code(404).send();
      }

      const canCreate = body.canCreate ?? false;
      const canUpdate = body.canUpdate ?? false;
      const canDelete = body.canDelete ?? false;
      upsertShare(db, request.usernameHash, sharedWithUser.username_hash, {
        canRead: body.canRead === true || canCreate || canUpdate || canDelete,
        canCreate: body.canCreate ?? false,
        canUpdate: body.canUpdate ?? false,
        canDelete: body.canDelete ?? false,
      });

      response.code(204).send();
    })
  );

  app.delete(
    `${API_PREFIX}/user/shares/incoming/:ownerUserShareCode`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { ownerUserShareCode } = request.params as Record<string, string>;
      if (typeof ownerUserShareCode !== 'string' || !ownerUserShareCode.trim()) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const owner = findUserByShareCode(db, ownerUserShareCode.trim());
      if (!owner) {
        return response.code(404).send();
      }

      deleteShare(db, owner.username_hash, request.usernameHash);

      response.code(204).send();
    })
  );

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
