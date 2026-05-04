import { API_PREFIX } from '@shared/constants/api-const';
import type { Application } from 'express';
import { getDatabase } from '../core/database/database';
import { findCollectionItemSuggestions } from '../core/database/repositories/collection-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/items/search-suggestions`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const query = typeof request.query.query === 'string' ? request.query.query : '';
      const limit = parseNumber(request.query.limit, 10);
      response.send({ suggestions: findCollectionItemSuggestions(getDatabase(), request.usernameHash, query, limit) });
    })
  );
};
