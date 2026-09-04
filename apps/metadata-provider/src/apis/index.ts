import type { FastifyInstance } from 'fastify';
import { register as registerGetItem } from './get-item-api';
import { register as registerGetItemByImdb } from './get-item-by-imdb-api';
import { register as registerGetSeasons } from './get-seasons-api';
import { register as registerHealth } from './health-api';
import { register as registerListProviders } from './list-providers-api';
import { register as registerSearch } from './search-api';

export const registerAllApis = (app: FastifyInstance): void => {
  registerHealth(app);
  registerListProviders(app);
  registerSearch(app);
  registerGetItemByImdb(app);
  registerGetSeasons(app);
  registerGetItem(app);
};
