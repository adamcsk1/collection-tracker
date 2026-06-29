import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { upsertShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: FastifyInstance): void => {
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
};
