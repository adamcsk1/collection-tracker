import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagConfigsApiResponseModel } from '@shared/models/api-model';
import { getDatabase } from '../core/database/database';
import { findTagConfigs } from '../core/database/repositories/tag-config-repository';
import type { Application } from 'express';

export const register = (app: Application): void => {
  app.get(
    `${API_PREFIX}/tag/config`,
    jwtGuard,
    withErrorHandler((request, response) => {
      response.send(findTagConfigs(getDatabase(), request.usernameHash) satisfies TagConfigsApiResponseModel);
    })
  );
};
