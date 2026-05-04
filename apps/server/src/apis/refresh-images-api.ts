import { API_PREFIX } from '@shared/constants/api-const';
import { RefreshImagesApiResponseModel } from '@shared/models/api-model';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import type { Application } from 'express';
import { OMDB_API } from '../core/constants/omdb-const';
import { getDatabase } from '../core/database/database';
import { findCollectionItems, updateCollectionItem } from '../core/database/repositories/collection-repository';
import { fetchAndCacheImage } from '../core/image/image-proxy';
import { jwtGuard } from '../core/jwt';
import { debugLog } from '../core/logger';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash } from '../core/utils/collection-item-util';

const fetchOMDbItem = async (imdbId: string, apiKey: string): Promise<OMDbResponseItemModel | null> => {
  const url = new URL(OMDB_API);
  url.searchParams.append('i', imdbId);
  url.searchParams.append('apikey', apiKey);

  try {
    const response = await fetch(url.href);
    if (!response.ok) {
      await debugLog(`[${imdbId}] OMDb fetch failed with status ${response.status}`);
      return null;
    }
    const data = (await response.json()) as OMDbResponseItemModel;
    await debugLog(`[${imdbId}] OMDb fetch succeeded`);
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await debugLog(`[${imdbId}] OMDb fetch error: ${message}`);
    return null;
  }
};

export const register = (app: Application): void => {
  app.post(
    `${API_PREFIX}/items/refresh-images`,
    jwtGuard,
    withErrorHandler(async (request, response) => {
      await debugLog('POST /items/refresh-images started');
      const db = getDatabase();
      const items = findCollectionItems(db, request.usernameHash, 0, Number.MAX_SAFE_INTEGER);
      const apiKey = process.env.OMDB_API_KEY!;

      await debugLog(`Found ${items.length} items to check`);

      let checked = 0;
      let fixed = 0;
      let errors = 0;

      for (const item of items) {
        checked++;
        await debugLog(`[${item.IMDbId}] Checking image availability: ${item.image}`);
        const imageAvailable = await fetchAndCacheImage(item.image);

        if (imageAvailable) {
          await debugLog(`[${item.IMDbId}] Image is available`);
          continue;
        }

        await debugLog(`[${item.IMDbId}] Image missing, fetching OMDb`);
        const omdbItem = await fetchOMDbItem(item.IMDbId, apiKey);

        if (omdbItem?.imdbID && omdbItem.Poster && omdbItem.Poster !== item.image) {
          await debugLog(`[${item.IMDbId}] New poster found, updating item`);
          const updatedItem = {
            ...item,
            image: omdbItem.Poster,
          };
          const newHash = getItemHash(updatedItem);
          updateCollectionItem(db, request.usernameHash, item.IMDbId, newHash, updatedItem);
          fixed++;
        } else {
          await debugLog(`[${item.IMDbId}] No new poster available from OMDb`);
          errors++;
        }
      }

      await debugLog(`POST /items/refresh-images finished: checked=${checked}, fixed=${fixed}, errors=${errors}`);

      const result: RefreshImagesApiResponseModel = {
        count: items.length,
        checked,
        fixed,
        errors,
      };

      response.send(result);
    })
  );
};
