import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(`${API_PREFIX}/user/access-token/:tokenHash`, jwtGuard, (request, response) => {
    try {
      const { tokenHash } = request.params;
      const users = Store.getLastValue('users');

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (token) => token.tokenHash !== tokenHash
      );
      Store.set('users', users);

      response.sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  });
};
