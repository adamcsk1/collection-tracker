import { cookieConfig, cookieExpiration } from '@server/core/cookie/cookie-config';
import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { hashText } from '@server/core/crypto';
import { generateAccessToken } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { getUserAccessToken } from '@server/core/utils/users-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { SignInApiRequestModel } from '@shared/models/api-model';
import dayjs from 'dayjs';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/sign-in`, async (request, response) => {
    try {
      const { username, token } = request.body as SignInApiRequestModel;
      const users = Store.getLastValue('users');

      const usernameHash = await hashText(`${username}${process.env.SALT}`);

      if (!users[usernameHash]) return response.sendStatus(404);

      const userTokenHash = await hashText(`${token}${process.env.SALT}`);

      if (users[usernameHash].userTokenHash !== userTokenHash) return response.sendStatus(401);

      if (users[usernameHash].userTokenHash === userTokenHash) {
        const cookie = cookieConfig();
        const newAccessToken = await generateAccessToken(
          username,
          `${cookieExpiration.value} ${cookieExpiration.unit}`
        );
        users[usernameHash].accessTokens.push(
          await getUserAccessToken(newAccessToken, request.headers['user-agent'], cookie.expires)
        );
        users[usernameHash].accessTokens = users[usernameHash].accessTokens.filter(
          (token) => token.expiredAt !== null && dayjs(token.expiredAt).isAfter(dayjs())
        );
        Store.set('users', users);

        response.cookie(COOKIE_TOKEN, newAccessToken, cookie).send();
      } else response.sendStatus(403);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
