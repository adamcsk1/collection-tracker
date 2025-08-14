import { hashText } from '@server/core/crypto';
import { verifyAccessToken } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { SignInApiRequestModel } from '@shared/models/api-model';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-in`, async (req, res) => {
    try {
      const { username, token } = req.body as SignInApiRequestModel;
      const users = Store.getLastValue('users');

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (!users[usernameHash]) {
        return res.sendStatus(404);
      }

      const tokenHash = await hashText(`${token}${process.env.SALT}`);
      if (users[usernameHash].accessTokenHash !== tokenHash) {
        return res.sendStatus(401);
      }

      try {
        await verifyAccessToken(username, token);
        res.send();
      } catch {
        res.sendStatus(403);
      }
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
