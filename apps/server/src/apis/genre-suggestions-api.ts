import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { findGenreSuggestions } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 10;
};

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/genres/suggestions`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const query = typeof request.query.query === 'string' ? request.query.query : '';

      response.send({
        genres: findGenreSuggestions(getDatabase(), request.usernameHash, query, parseLimit(request.query.limit)),
      });
    })
  );
};
