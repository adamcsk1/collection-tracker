import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { getCollectionStatistics } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { parseFilters } from '../core/utils/query-parse-util';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/statistics`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      response.send(getCollectionStatistics(getDatabase(), request.usernameHash, parseFilters(request.query)));
    })
  );
};
