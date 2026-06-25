import { API_PREFIX } from '@shared/constants/api-const';
import { RefreshImagesApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  countCollectionItems,
  findCollectionItems,
  updateCollectionItem,
} from '../core/database/repositories/collection';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { fetchAndCacheImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { fetchOMDbItem } from '../core/omdb/omdb-item';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash } from '../core/utils/collection-item-util';

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/items/refresh-images`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      await debugLog('POST /items/refresh-images started');
      const db = getDatabase();
      const apiKey = process.env.OMDB_API_KEY;
      const query = (request.query ?? {}) as Record<string, unknown>;
      const ownerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!ownerHash) {
        return response.code(404).send();
      }

      if (!canAccessLibrary(db, request.usernameHash, ownerHash, 'update')) {
        return response.code(403).send();
      }

      const totalItems = countCollectionItems(db, [ownerHash]);
      const batchSize = 50;

      await debugLog(`Found ${totalItems} items to check`);

      let checked = 0;
      let fixed = 0;
      let errors = 0;
      let offset = 0;

      while (offset < totalItems) {
        const items = findCollectionItems(db, [ownerHash], offset, batchSize);
        for (const item of items) {
          checked++;
          await debugLog(`[${item.IMDbId}] Checking image availability: ${item.image}`);
          const imageAvailable = await fetchAndCacheImage(item.image);

          if (imageAvailable) {
            await debugLog(`[${item.IMDbId}] Image is available`);
            continue;
          }

          await debugLog(`[${item.IMDbId}] Image missing, fetching OMDb`);
          if (!apiKey) {
            await debugLog(`[${item.IMDbId}] OMDb API key is missing`);
            errors++;
            continue;
          }

          const omdbItem = await fetchOMDbItem(item.IMDbId, apiKey);

          if (omdbItem?.imdbID && omdbItem.Poster && omdbItem.Poster !== item.image) {
            await debugLog(`[${item.IMDbId}] New poster found, updating item`);
            const updatedItem = {
              ...item,
              image: omdbItem.Poster,
            };
            const newHash = getItemHash(updatedItem);
            updateCollectionItem(db, ownerHash, item.IMDbId, newHash, updatedItem);
            fixed++;
          } else {
            await debugLog(`[${item.IMDbId}] No new poster available from OMDb`);
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
