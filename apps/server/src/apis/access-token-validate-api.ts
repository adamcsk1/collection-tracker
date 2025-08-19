import { jwtGuard } from '@server/core/jwt';
import { Store } from '@server/core/store/store';
import { ExtendedRequestModel } from '@server/models/express-model';
import { API_PREFIX } from '@shared/constants/api-const';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/user/access-token/validate`, jwtGuard, (_request: ExtendedRequestModel, response) =>
    response.sendStatus(204)
  )
);
