import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';

Store.getOnce$('app').subscribe((app) =>
  app.delete(`${API_PREFIX}/logout`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const token = request.signedCookies[COOKIE_TOKEN];
      const tokenHash = await hashText(token);
      const users = Store.getLastValue('users');

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (token) => token.tokenHash !== tokenHash
      );
      Store.set('users', users);

      response.clearCookie(COOKIE_TOKEN).sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
