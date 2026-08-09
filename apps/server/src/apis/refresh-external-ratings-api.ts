import { API_PREFIX } from '@shared/constants/api-const';
import { CollectionItemApiModel, RefreshExternalRatingsApiResponseModel } from '@shared/models/api-model';
import { getExternalMetadataRating } from '@shared/utils/external-metadata-ratings-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  countCollectionItems,
  findCollectionItems,
  updateCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { canAccessShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { getExternalMetadataProviderByName } from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash } from '../core/utils/collection-item-util';

const buildUpdatedItem = (
  item: CollectionItemApiModel,
  imdbRate: string,
  rottenTomatoesRate: string,
  metacriticRate: string
): CollectionItemApiModel => ({
  ...item,
  rate: imdbRate,
  rottenTomatoesRate,
  metacriticRate,
});

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/collection-items/actions/refresh-external-ratings`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      await debugLog('POST /collection-items/actions/refresh-external-ratings started');
      const db = getDatabase();
      const query = (request.query ?? {}) as Record<string, unknown>;
      const ownerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!ownerHash) {
        return response.code(404).send();
      }

      const sharedOperation = ownerHash !== request.usernameHash;
      const excludedContentTypes = (['movie', 'series', 'book'] as const).filter(
        (contentType) =>
          contentType === 'book' ||
          (sharedOperation && !canAccessShare(db, request.usernameHash, ownerHash, 'library', contentType, 'update'))
      );
      if (sharedOperation && excludedContentTypes.length === 3) {
        return response.code(403).send();
      }

      const targetListType = sharedOperation ? 'library' : 'all';
      const totalItems = countCollectionItems(db, [ownerHash], targetListType, excludedContentTypes);
      const batchSize = 50;

      await debugLog(`Found ${totalItems} items to check`);

      let checked = 0;
      let fixed = 0;
      let errors = 0;
      let offset = 0;

      while (offset < totalItems) {
        const items = findCollectionItems(
          db,
          [ownerHash],
          offset,
          batchSize,
          targetListType,
          ownerHash,
          excludedContentTypes
        );
        for (const item of items) {
          checked++;
          const logId = item.IMDbId ?? item.externalItemId;

          const provider = getExternalMetadataProviderByName(item.externalProvider);
          if (!provider) {
            await debugLog(`[${logId}] External metadata provider is not configured`);
            errors++;
            continue;
          }

          await debugLog(`[${logId}] Fetching external ratings`);
          let metadataItem: Awaited<ReturnType<typeof provider.getItem>>;
          try {
            metadataItem = await provider.getItem(item.externalItemId);
          } catch {
            errors++;
            continue;
          }

          if (
            !metadataItem?.providerItemId ||
            metadataItem.provider !== item.externalProvider ||
            metadataItem.providerItemId !== item.externalItemId
          ) {
            await debugLog(`[${logId}] No external metadata item available`);
            errors++;
            continue;
          }

          const updatedItem = buildUpdatedItem(
            item,
            getExternalMetadataRating(metadataItem.ratings, 'Internet Movie Database') || item.rate,
            getExternalMetadataRating(metadataItem.ratings, 'Rotten Tomatoes'),
            getExternalMetadataRating(metadataItem.ratings, 'Metacritic')
          );

          if (
            updatedItem.rate === item.rate &&
            updatedItem.rottenTomatoesRate === item.rottenTomatoesRate &&
            updatedItem.metacriticRate === item.metacriticRate
          ) {
            await debugLog(`[${logId}] Ratings are unchanged`);
            continue;
          }

          await debugLog(`[${logId}] Ratings changed, updating item`);
          const newHash = getItemHash(updatedItem);
          updateCollectionItemByExternalId(
            db,
            ownerHash,
            item.externalProvider,
            item.externalItemId,
            newHash,
            updatedItem,
            item.listType
          );
          fixed++;
        }
        offset += batchSize;
      }

      await debugLog(
        `POST /collection-items/actions/refresh-external-ratings finished: checked=${checked}, fixed=${fixed}, errors=${errors}`
      );

      const result: RefreshExternalRatingsApiResponseModel = {
        count: totalItems,
        checked,
        fixed,
        errors,
      };

      response.send(result);
    })
  );
};
