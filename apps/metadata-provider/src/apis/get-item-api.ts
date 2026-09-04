import { isExternalMetadataProviderName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance } from 'fastify';
import { getExternalMetadataProviderByName } from '../core/external-metadata-provider-factory';

export const register = (app: FastifyInstance): void => {
  app.get('/v1/:provider/items/:providerItemId', async (request, response) => {
    const { provider: providerName, providerItemId } = request.params as {
      provider: string;
      providerItemId: string;
    };
    if (!isExternalMetadataProviderName(providerName) || !providerItemId) {
      response.code(400).send();
      return;
    }
    const provider = getExternalMetadataProviderByName(providerName);
    if (!provider) {
      response.code(404).send();
      return;
    }
    const item = await provider.getItem(providerItemId);
    if (!item) {
      response.code(404).send();
      return;
    }
    response.send({ data: item });
  });
};
