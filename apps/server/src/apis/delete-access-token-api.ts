import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.delete(
    `${API_PREFIX}/user/access-token/:tokenHash`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const { tokenHash } = request.params;
      const users = Store.getLastValue('users');

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (token) => token.tokenHash !== tokenHash
      );
      Store.set('users', users);

      response.sendStatus(204);
    })
  );
};
