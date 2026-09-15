import { describeMetadataError } from '@node/utils/metadata-error-util';
import { isExternalMetadataProviderName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { debugLog, errorLog } from './logger';

const requestContext = (request: FastifyRequest): string => {
  const provider = (request.params as { provider?: string } | undefined)?.provider;
  return JSON.stringify({
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url,
    provider: typeof provider === 'string' && isExternalMetadataProviderName(provider) ? provider : undefined,
  });
};

export const registerRequestLogging = (app: FastifyInstance): void => {
  app.addHook('onError', async (request, response, error) => {
    await errorLog(
      `${requestContext(request)} elapsedMs=${Math.round(response.elapsedTime)} error=${describeMetadataError(error)}`
    );
  });
  app.addHook('onResponse', async (request, response) => {
    await debugLog(
      `${requestContext(request)} status=${response.statusCode} elapsedMs=${Math.round(response.elapsedTime)}`
    );
  });
};
