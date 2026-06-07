import { API_PREFIX } from '@shared/constants/api-const';
import { CollectionItemApiModel, RefreshExternalRatingsApiResponseModel } from '@shared/models/api-model';
import { OMDbResponseRatingModel } from '@shared/models/omdb-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  countCollectionItems,
  findCollectionItems,
  updateCollectionItem,
} from '../core/database/repositories/collection';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { fetchOMDbItem } from '../core/omdb/omdb-item';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash } from '../core/utils/collection-item-util';

const getRating = (ratings: OMDbResponseRatingModel[] | undefined, source: string): string =>
  ratings?.find((rating) => rating.Source === source)?.Value ?? '';

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
    `${API_PREFIX}/items/refresh-external-ratings`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      await debugLog('POST /items/refresh-external-ratings started');
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

          if (!apiKey?.trim()) {
            await debugLog(`[${item.IMDbId}] OMDb API key is missing`);
            errors++;
            continue;
          }

          await debugLog(`[${item.IMDbId}] Fetching OMDb ratings`);
          const omdbItem = await fetchOMDbItem(item.IMDbId, apiKey);
          if (!omdbItem?.imdbID) {
            await debugLog(`[${item.IMDbId}] No OMDb item available`);
            errors++;
            continue;
          }

          const updatedItem = buildUpdatedItem(
            item,
            omdbItem.imdbRating ?? item.rate,
            getRating(omdbItem.Ratings, 'Rotten Tomatoes'),
            getRating(omdbItem.Ratings, 'Metacritic')
          );

          if (
            updatedItem.rate === item.rate &&
            updatedItem.rottenTomatoesRate === item.rottenTomatoesRate &&
            updatedItem.metacriticRate === item.metacriticRate
          ) {
            await debugLog(`[${item.IMDbId}] Ratings are unchanged`);
            continue;
          }

          await debugLog(`[${item.IMDbId}] Ratings changed, updating item`);
          const newHash = getItemHash(updatedItem);
          updateCollectionItem(db, ownerHash, item.IMDbId, newHash, updatedItem);
          fixed++;
        }
        offset += batchSize;
      }

      await debugLog(
        `POST /items/refresh-external-ratings finished: checked=${checked}, fixed=${fixed}, errors=${errors}`
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
