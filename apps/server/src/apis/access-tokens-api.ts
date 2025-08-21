import { jwtGuard } from '@server/core/jwt';
import { errorLog } from '@server/core/logger';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/user/access-tokens`, jwtGuard, (request: ExtendedRequestModel, response) => {
    try {
      const users = Store.getLastValue('users');
      const result: AccessTokensApiResponseModel = users[request.usernameHash].accessTokens;
      response.send(result);
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Unknown error (${error.message})`);
      response.sendStatus(500);
    }
  })
);
