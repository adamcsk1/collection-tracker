import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { deleteAccessToken } from '../core/database/repositories/user-repository';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(
    `${API_PREFIX}/user/access-token/:tokenHash`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const { tokenHash } = request.params;
      deleteAccessToken(getDatabase(), request.usernameHash, tokenHash as string);
      response.sendStatus(204);
    })
  );
};
