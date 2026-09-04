import { isExternalMetadataProviderName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviderByName } from '../core/external-metadata-provider-factory';

export const register = (app: FastifyInstance): void => {
  app.get('/v1/:provider/search', async (request, response) => {
    const { provider: providerName } = request.params as { provider: string };
    const query = request.query as { s?: unknown };
    const searchText = typeof query.s === 'string' ? query.s : '';
    if (!isExternalMetadataProviderName(providerName) || !searchText.trim()) {
      response.code(400).send();
      return;
    }
    const provider = getExternalMetadataProviderByName(providerName);
    if (!provider) {
      response.code(404).send();
      return;
    }
    response.send({ data: await provider.search(searchText) });
  });
};
