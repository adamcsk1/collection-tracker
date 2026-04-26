import { jwtGuard } from '../core/jwt';
import { Store } from '../core/store/store';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { TagConfigsApiRequestModel } from '@shared/models/api-model';
import type { Application } from 'express';

const isTagConfig = (tagConfig: unknown): tagConfig is TagConfigsApiRequestModel => {
  if (typeof tagConfig !== 'object' || tagConfig === null || Array.isArray(tagConfig)) return false;
  const candidate = tagConfig as Record<string, unknown>;
  return (
    typeof candidate.tag === 'string' &&
    typeof candidate.color === 'string' &&
    typeof candidate.useForImageBorder === 'boolean' &&
    typeof candidate.useForTextColor === 'boolean' &&
    typeof candidate.useForImageBadge === 'boolean' &&
    typeof candidate.weight === 'number' &&
    Number.isFinite(candidate.weight)
  );
};

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/tag/change-config`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      const body = request.body as TagConfigsApiRequestModel;
      if (!Array.isArray(body) || body.some((tagConfig) => !isTagConfig(tagConfig))) {
        return response.sendStatus(400);
      }

      const tagConfigs = Store.getLastValue('tagConfigs');
      tagConfigs[request.usernameHash] = body;
      Store.set('tagConfigs', tagConfigs);

      response.send(body);
    })
  );
};
