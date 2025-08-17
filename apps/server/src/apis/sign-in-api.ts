import { hashText } from '@server/core/crypto';
import { generateAccessToken } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { SignInApiRequestModel, SignInApiResponseModel } from '@shared/models/api-model';
import dayjs from 'dayjs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-in`, async (req, res) => {
    try {
      const { username, token } = req.body as SignInApiRequestModel;
      const users = Store.getLastValue('users');

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (!users[usernameHash]) {
        return res.sendStatus(404);
      }

      const userTokenHash = await hashText(`${token}${process.env.SALT}`);
      if (users[usernameHash].userTokenHash !== userTokenHash) {
        return res.sendStatus(401);
      }

      if (users[usernameHash].userTokenHash === userTokenHash) {
        const newAccessToken = await generateAccessToken(username);
        users[usernameHash].accessTokens.push({
          tokenHash: await hashText(`${newAccessToken}${process.env.SALT}`),
          createdAt: dayjs().toISOString(),
          userAgent: req.headers['user-agent'],
        });
        const result: SignInApiResponseModel = { accessToken: newAccessToken };
        res.send(result);
      } else {
        res.sendStatus(403);
      }
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      res.sendStatus(500);
    }
  })
);
