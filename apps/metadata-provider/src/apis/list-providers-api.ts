import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviders } from '../core/external-metadata-provider-factory';
import { hasSeasonMetadata } from '../core/provider-util';

export const register = (app: FastifyInstance): void => {
  app.get('/v1/providers', async (_request, response) => {
    response.send({
      data: {
        providers: getExternalMetadataProviders().map((provider) => ({
          name: provider.name,
          supportsSeasonMetadata: hasSeasonMetadata(provider),
          supportsDirectImdbId: provider.supportsDirectImdbId === true,
        })),
      },
    });
  });
};
