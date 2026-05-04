import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import { deleteUser } from '../core/database/repositories/user-repository';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(
    `${API_PREFIX}/user`,
    jwtGuard,
    withErrorHandler((request, response) => {
      deleteUser(getDatabase(), request.usernameHash);

      response.sendStatus(204);
    })
  );
};
