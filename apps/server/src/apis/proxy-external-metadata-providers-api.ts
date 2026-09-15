import { hasSeasonMetadata } from '@node/utils/has-season-metadata-util';
import { API_PREFIX } from '@shared/constants/api-const';
import { ExternalMetadataProviderModel } from '@shared/models/external-metadata-model';
import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviders } from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const toProviderModel = (
  provider: ReturnType<typeof getExternalMetadataProviders>[number]
): ExternalMetadataProviderModel => ({
  name: provider.name,
  supportsSeasonMetadata: hasSeasonMetadata(provider),
  supportsDirectImdbId: provider.supportsDirectImdbId === true,
});

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/external-metadata/providers`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      void request;
      response.send({ providers: getExternalMetadataProviders().map(toProviderModel) });
    })
  );
};
