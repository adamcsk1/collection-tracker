import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { RenameTagApiRequestModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { renameTag } from '../core/database/repositories/tag-management-repository';
import type { FastifyInstance } from 'fastify';

const parseRenameRequest = (body: unknown): RenameTagApiRequestModel | undefined => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.oldTag !== 'string' || typeof candidate.newTag !== 'string') return undefined;
  const oldTag = candidate.oldTag.trim();
  const newTag = candidate.newTag.trim();
  if (!oldTag || !newTag || oldTag === newTag) return undefined;
  return { oldTag, newTag };
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/users/me/tags/rename`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = parseRenameRequest(request.body);
      if (!body) {
        return response.code(400).send();
      }

      response.send(renameTag(getDatabase(), request.usernameHash, body.oldTag, body.newTag));
    })
  );
};
