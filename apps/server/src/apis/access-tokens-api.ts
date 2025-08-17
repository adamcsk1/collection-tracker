import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { API_PREFIX } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { AccessTokensResponseModel } from '@shared/models/api-model';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/user/access-tokens`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const users = Store.getLastValue('users');
      const result: AccessTokensResponseModel = users[request.usernameHash].accessTokens;
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
