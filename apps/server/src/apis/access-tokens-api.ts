import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { findAccessTokensByUser } from '../core/database/repositories/user-repository';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/user/access-tokens`,
    jwtGuard,
    withErrorHandler((request, response) => {
      const allTokens: AccessTokensApiResponseModel = findAccessTokensByUser(getDatabase(), request.usernameHash);
      const seen = new Set<string>();
      const result: AccessTokensApiResponseModel = allTokens.filter((token) => {
        if (seen.has(token.tokenHash)) return false;
        seen.add(token.tokenHash);
        return true;
      });

      response.send(result);
    })
  );
};
