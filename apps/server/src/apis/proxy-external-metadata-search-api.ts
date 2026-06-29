import { API_PREFIX } from '@shared/constants/api-const';
import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import { ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import type { FastifyInstance } from 'fastify';
import {
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const searchAllProviders = async (searchText: string): Promise<ExternalMetadataSearchResponseModel> => {
  const providers = getExternalMetadataProviders();
  const results = await Promise.allSettled(providers.map((provider) => provider.search(searchText)));
  const fulfilledResults = results.filter((result) => result.status === 'fulfilled');
  if (!fulfilledResults.length) throw new Error('External metadata provider search failed');

  return {
    results: fulfilledResults.flatMap((result) => result.value.results),
  };
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/external-metadata/search`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      if (typeof query.s !== 'string' || query.s.trim() === '') {
        response.code(400).send();
        return;
      }

      const requestedProvider = typeof query.provider === 'string' ? query.provider.trim() : '';
      if (requestedProvider && requestedProvider !== DEFAULT_EXTERNAL_METADATA_PROVIDER) {
        response.code(400).send();
        return;
      }
      const provider = requestedProvider ? getExternalMetadataProviderByName(requestedProvider) : null;
      if (!requestedProvider && getExternalMetadataProviders().length === 0) {
        response.code(503).send();
        return;
      }
      if (!provider) {
        if (requestedProvider) {
          response.code(503).send();
          return;
        }
      }

      try {
        response.send(provider ? await provider.search(query.s) : await searchAllProviders(query.s));
      } catch {
        response.code(502).send();
      }
    })
  );
};
