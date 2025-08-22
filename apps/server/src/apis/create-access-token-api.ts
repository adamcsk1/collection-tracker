import { generateAccessToken, jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { getUserAccessToken } from '@server/core/utils/users-util';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { CreateAccessTokenApiResponseModel } from '@shared/models/api-model';

Store.getOnce$('app').subscribe((app) =>
  app.post(`${API_PREFIX}/user/access-token`, jwtGuard, async (request: ExtendedRequestModel, response) => {
    try {
      const users = Store.getLastValue('users');

      const newAccessToken = await generateAccessToken(request.username);

      users[request.usernameHash].accessTokens.push(
        await getUserAccessToken(newAccessToken, request.headers['user-agent'], null)
      );
      Store.set('users', users);

      const result: CreateAccessTokenApiResponseModel = { accessToken: newAccessToken };
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
