import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { searchCollectionItems } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { parseFilters, parseNumber } from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/items`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      response.send(
        searchCollectionItems(getDatabase(), request.usernameHash, {
          filters: parseFilters(request.query),
          offset: parseNumber(request.query.offset, 0),
          limit: parseNumber(request.query.limit, 50),
        })
      );
    })
  );
};
