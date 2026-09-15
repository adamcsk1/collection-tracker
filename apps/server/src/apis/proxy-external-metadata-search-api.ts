import { API_PREFIX } from '@shared/constants/api-const';
import { ExternalMetadataProvider } from '@node/models/external-metadata-runtime-model';
import { describeMetadataError } from '@node/utils/metadata-error-util';
import { isExternalMetadataProviderName } from '@shared/utils/external-metadata-provider-util';
import { ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import type { FastifyInstance } from 'fastify';
import {
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { errorLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';

const searchProvider = async (
  provider: ExternalMetadataProvider,
  searchText: string,
  requestId: string
): Promise<ExternalMetadataSearchResponseModel> => {
  const started = performance.now();
  try {
    return await provider.search(searchText);
  } catch (error) {
    await errorLog(
      `External metadata search ${JSON.stringify({ requestId, provider: provider.name, elapsedMs: Math.round(performance.now() - started), error: describeMetadataError(error) })}`
    );
    throw error;
  }
};

const searchAllProviders = async (
  searchText: string,
  requestId: string
): Promise<ExternalMetadataSearchResponseModel> => {
  const providers = getExternalMetadataProviders();
  const results = await Promise.allSettled(
    providers.map((provider) => searchProvider(provider, searchText, requestId))
  );
  const fulfilledResults = results.filter((result) => result.status === 'fulfilled');
  if (!fulfilledResults.length) throw new Error('External metadata provider search failed');

  return {
    results: fulfilledResults.flatMap((result) => result.value.results),
  };
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/external-metadata/search`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      if (typeof query.s !== 'string' || query.s.trim() === '') {
        response.code(400).send();
        return;
      }

      const requestedProvider = typeof query.provider === 'string' ? query.provider.trim().toLowerCase() : '';
      if (requestedProvider && !isExternalMetadataProviderName(requestedProvider)) {
        response.code(400).send();
        return;
      }

      if (!requestedProvider && getExternalMetadataProviders().length === 0) {
        response.code(503).send();
        return;
      }

      const provider = requestedProvider ? getExternalMetadataProviderByName(requestedProvider) : null;
      if (requestedProvider && !provider) {
        response.code(503).send();
        return;
      }

      try {
        response.send(
          provider ? await searchProvider(provider, query.s, request.id) : await searchAllProviders(query.s, request.id)
        );
      } catch {
        response.code(502).send();
      }
    })
  );
};
