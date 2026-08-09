import { API_PREFIX } from '@shared/constants/api-const';
import type { UserShareGrantApiModel } from '@shared/models/api-model';
import { isValidShareScope, normalizeShareGrants } from '@shared/utils/share-grant-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { upsertShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const isGrantArray = (value: unknown): value is UserShareGrantApiModel[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as UserShareGrantApiModel).listType === 'string' &&
      typeof (entry as UserShareGrantApiModel).contentType === 'string' &&
      typeof (entry as UserShareGrantApiModel).canRead === 'boolean' &&
      typeof (entry as UserShareGrantApiModel).canCreate === 'boolean' &&
      typeof (entry as UserShareGrantApiModel).canUpdate === 'boolean' &&
      typeof (entry as UserShareGrantApiModel).canDelete === 'boolean'
  );

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/user/shares`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as {
        sharedWithUserShareCode?: string;
        grants?: unknown;
      };

      if (typeof body?.sharedWithUserShareCode !== 'string' || !body.sharedWithUserShareCode.trim()) {
        return response.code(400).send();
      }
      if (!isGrantArray(body.grants)) {
        return response.code(400).send();
      }

      const scopes = new Set<string>();
      for (const grant of body.grants) {
        if (!isValidShareScope(grant.listType, grant.contentType)) {
          return response.code(400).send();
        }
        const scope = `${grant.listType}:${grant.contentType}`;
        if (scopes.has(scope)) {
          return response.code(400).send();
        }
        scopes.add(scope);
      }

      const grants = normalizeShareGrants(body.grants);
      if (!grants.length) {
        return response.code(400).send();
      }

      const db = getDatabase();
      const sharedWithUser = findUserByShareCode(db, body.sharedWithUserShareCode.trim());
      if (!sharedWithUser || sharedWithUser.username_hash === request.usernameHash) {
        return response.code(404).send();
      }

      upsertShare(db, request.usernameHash, sharedWithUser.username_hash, grants);
      response.code(204).send();
    })
  );
};
