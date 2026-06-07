import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagManagementApiResponseModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { findTagManagement } from '../core/database/repositories/tag-management-repository';
import type { FastifyInstance } from 'fastify';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/tag-management`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      response.send(findTagManagement(getDatabase(), request.usernameHash) satisfies TagManagementApiResponseModel);
    })
  );
};
