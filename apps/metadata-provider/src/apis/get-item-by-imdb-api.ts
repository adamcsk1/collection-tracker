import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviderByName } from '../core/external-metadata-provider-factory';

export const register = (app: FastifyInstance): void => {
  app.get('/v1/omdb/items/by-imdb/:imdbId', async (request, response) => {
    const { imdbId } = request.params as { imdbId: string };
    const provider = getExternalMetadataProviderByName('omdb');
    if (!provider?.getItemByImdbId) {
      response.code(404).send();
      return;
    }
    const item = await provider.getItemByImdbId(imdbId);
    if (!item) {
      response.code(404).send();
      return;
    }
    response.send({ data: item });
  });
};
