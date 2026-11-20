import { API_PREFIX } from '@shared/constants/api-const';
import { USER_AVATAR_MAX_BASE64_LENGTH } from '@shared/constants/user-profile-const';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findUserProfile, updateUserAvatar } from '../core/database/repositories/user-profile-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { sanitizeUserAvatar } from '../core/utils/user-profile-util';

export const register = (app: FastifyInstance): void => {
  app.put(
    `${API_PREFIX}/users/me/avatar`,
    {
      preHandler: jwtGuard,
      bodyLimit: USER_AVATAR_MAX_BASE64_LENGTH + 1024,
    },
    withErrorHandler(async (request, response) => {
      const body = request.body;
      if (
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'imageBase64')
      ) {
        return response.code(400).send();
      }
      const avatar = await sanitizeUserAvatar((body as Record<string, unknown>).imageBase64);
      if (!avatar) return response.code(400).send();
      const db = getDatabase();
      if (!findUserProfile(db, request.usernameHash)) return response.code(404).send();
      updateUserAvatar(db, request.usernameHash, avatar);
      response.send(findUserProfile(db, request.usernameHash));
    })
  );
};
