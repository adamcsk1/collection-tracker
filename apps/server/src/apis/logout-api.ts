import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.delete(`${API_PREFIX}/logout`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const token = request.signedCookies[COOKIE_TOKEN];
      const tokenHash = await hashText(`${token}${process.env.SALT}`);
      const users = Store.getLastValue('users');

      users[request.usernameHash].accessTokens = users[request.usernameHash].accessTokens.filter(
        (token) => token.tokenHash !== tokenHash
      );
      Store.set('users', users);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      response.clearCookie(COOKIE_TOKEN).sendStatus(204);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
