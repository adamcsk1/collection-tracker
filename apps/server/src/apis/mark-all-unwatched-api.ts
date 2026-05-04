import { API_PREFIX } from '@shared/constants/api-const';
import { MarkAllUnwatchedApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { markAllAsUnwatched } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/items/mark-all-unwatched`,
    jwtGuard,
    withErrorHandler(async (_request, response) => {
      const db = getDatabase();
      const changedCount = markAllAsUnwatched(db, _request.usernameHash);

      const result: MarkAllUnwatchedApiResponseModel = { changedCount };
      response.send(result);
    })
  );
};
