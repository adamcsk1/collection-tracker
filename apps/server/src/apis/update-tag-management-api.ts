import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagManagementApiRequestModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { upsertTagManagement } from '../core/database/repositories/tag-management-repository';
import type { FastifyInstance } from 'fastify';

const isTagManagement = (tagManagement: unknown): tagManagement is TagManagementApiRequestModel[number] => {
  if (typeof tagManagement !== 'object' || tagManagement === null || Array.isArray(tagManagement)) return false;
  const candidate = tagManagement as Record<string, unknown>;
  return (
    typeof candidate.tag === 'string' &&
    (typeof candidate.color === 'string' || candidate.color === null) &&
    typeof candidate.useForImageBorder === 'boolean' &&
    typeof candidate.useForTextColor === 'boolean' &&
    typeof candidate.useForImageBadge === 'boolean' &&
    typeof candidate.weight === 'number' &&
    Number.isFinite(candidate.weight)
  );
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/users/me/tags`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as TagManagementApiRequestModel;
      if (!Array.isArray(body) || body.some((tagManagement) => !isTagManagement(tagManagement))) {
        return response.code(400).send();
      }

      upsertTagManagement(getDatabase(), request.usernameHash, body);

      response.send(body);
    })
  );
};
