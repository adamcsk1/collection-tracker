import { API_PREFIX } from '@shared/constants/api-const';
import { CollectionItemContentTypeModel, RefreshImagesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  countCollectionItems,
  findCollectionItems,
  updateCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { canAccessShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { fetchAndCacheImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { getExternalMetadataProviderByName } from '../core/external-metadata/external-metadata-provider-factory';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash } from '../core/utils/collection-item-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/refresh-images`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      await debugLog('POST /items/refresh-images started');
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
      const excludedContentTypes: CollectionItemContentTypeModel[] = sharedOperation
        ? (['movie', 'series', 'book'] as const).filter(
            (contentType) => !canAccessShare(db, request.usernameHash, ownerHash, 'library', contentType, 'update')
          )
        : [];
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
          await debugLog(`[${logId}] Checking image availability: ${item.image}`);
          const imageAvailable = await fetchAndCacheImage(item.image);

          if (imageAvailable) {
            await debugLog(`[${logId}] Image is available`);
            continue;
          }

          await debugLog(`[${logId}] Image missing, fetching external metadata`);
          const provider = getExternalMetadataProviderByName(item.externalProvider);
          if (!provider) {
            await debugLog(`[${logId}] External metadata provider is not configured`);
            errors++;
            continue;
          }

          let metadataItem: Awaited<ReturnType<typeof provider.getItem>>;
          try {
            metadataItem = await provider.getItem(item.externalItemId);
          } catch {
            errors++;
            continue;
          }

          if (
            metadataItem?.providerItemId &&
            metadataItem.provider === item.externalProvider &&
            metadataItem.providerItemId === item.externalItemId &&
            metadataItem.poster &&
            metadataItem.poster !== item.image
          ) {
            await debugLog(`[${logId}] New poster found, updating item`);
            const updatedItem = {
              ...item,
              image: metadataItem.poster,
            };
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
          } else {
            await debugLog(`[${logId}] No new poster available from external metadata`);
            errors++;
          }
        }
        offset += batchSize;
      }

      await debugLog(`POST /items/refresh-images finished: checked=${checked}, fixed=${fixed}, errors=${errors}`);

      const result: RefreshImagesApiResponseModel = {
        count: totalItems,
        checked,
        fixed,
        errors,
      };

      response.send(result);
    })
  );
};
