import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviderByName } from '../core/external-metadata-provider-factory';
import { hasSeasonMetadata } from '../core/provider-util';

export const register = (app: FastifyInstance): void => {
  app.get('/v1/omdb/items/:providerItemId/seasons', async (request, response) => {
    const { providerItemId } = request.params as { providerItemId: string };
    const provider = getExternalMetadataProviderByName('omdb');
    if (!provider || !hasSeasonMetadata(provider)) {
      response.code(404).send();
      return;
    }
    response.send({ data: { seasons: await provider.getSeriesSeasons(providerItemId) } });
  });
};
