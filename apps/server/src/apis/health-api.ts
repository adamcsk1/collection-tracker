import { Store } from '@server/core/store/store';
import { API_PREFIX } from '@shared/constants/api-const';

Store.getOnce$('app').subscribe((app) => app.get(`${API_PREFIX}/health`, (req, res) => res.send({ message: 'Ok' })));
