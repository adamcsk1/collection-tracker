import { hashText } from '@server/core/crypto';
import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX, DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { writeFileSync } from 'fs';

Store.getOnce$('app').subscribe((app) =>
  app.put(`${API_PREFIX}/user/change-token`, jwtGuard, async (req: ExtendedRequestModel, res) => {
    try {
      let { expiration } = req.body;
      const users = Store.getLastValue('users');

      const newAccessToken = generateAccessToken(req.usernameHash, expiration);

      if (!newAccessToken) return res.sendStatus(500);

      writeFileSync(
        `${Store.getLastValue('dataFolder')}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );

      users[req.usernameHash].accessTokenHash = await hashText(`${newAccessToken}${process.env.SALT}`);
      Store.set('users', users);

      res.send({ newToken: newAccessToken });
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
