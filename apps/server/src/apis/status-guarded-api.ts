import { jwtGuard } from '@server/core/jwt';
import { API_PREFIX } from '@server/core/main-const';
import { Store } from '@server/core/store/store';

Store.getOnce$('app').subscribe((app) =>
  app.get(`${API_PREFIX}/status-guarded`, jwtGuard, (req, res) => res.send({ message: 'Ok' }))
);
