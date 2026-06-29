import { API_PREFIX } from '@shared/constants/api-const';
import {
  isExternalItemIdentitySourceName,
  isExternalMetadataProviderName,
} from '@shared/constants/external-metadata-const';
import type { FastifyInstance } from 'fastify';
import {
  getExternalMetadataProviderByName,
  getExternalMetadataProviders,
} from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';

const getItemByExternalIdentity = async (identitySource: string, identityId: string) => {
  if (isExternalMetadataProviderName(identitySource)) {
    const provider = getExternalMetadataProviderByName(identitySource);
    return provider
      ? { item: await provider.getItem(identityId), providerFound: true }
      : { item: null, providerFound: false };
  }

  if (identitySource === 'imdb') {
    const provider = getExternalMetadataProviders().find(
      (externalMetadataProvider) =>
        externalMetadataProvider.supportsDirectImdbId && externalMetadataProvider.getItemByImdbId
    );
    return provider?.getItemByImdbId
      ? { item: await provider.getItemByImdbId(identityId), providerFound: true }
      : { item: null, providerFound: false };
  }

  return { item: null, providerFound: false };
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/proxy/external-metadata/item`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const identitySource =
        typeof query.externalIdentitySource === 'string' ? query.externalIdentitySource.trim() : '';
      const identityId = typeof query.externalIdentityId === 'string' ? query.externalIdentityId.trim() : '';
      if (!identitySource || !isExternalItemIdentitySourceName(identitySource) || !identityId) {
        response.code(400).send();
        return;
      }

      try {
        const { item, providerFound } = await getItemByExternalIdentity(identitySource, identityId);
        if (!providerFound) {
          response.code(503).send();
          return;
        }

        if (!item) {
          response.code(404).send();
          return;
        }

        response.send(item);
      } catch {
        response.code(502).send();
      }
    })
  );
};
