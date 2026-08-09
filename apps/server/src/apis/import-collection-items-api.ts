import { API_PREFIX } from '@shared/constants/api-const';
import {
  CollectionItemChangeApiModel,
  CollectionItemsImportApiRequestModel,
  CollectionItemsImportApiResponseModel,
} from '@shared/models/api-model';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { getImdbIdFromExternalMetadata } from '@shared/utils/external-metadata-identity-util';
import { getExternalMetadataRating } from '@shared/utils/external-metadata-ratings-util';
import { getIMDbIds } from '@shared/utils/imdb-id-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  collectionCanonicalItemExists,
  collectionItemExistsByExternalId,
  insertCollectionItem,
} from '../core/database/repositories/collection';
import {
  resolveCanonicalItemId,
  resolveCanonicalItemIds,
} from '../core/database/repositories/external-item-identity-repository';
import { getDirectImdbExternalMetadataProvider } from '../core/external-metadata/external-metadata-provider-factory';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';

const MAX_COLLECTION_ITEM_IMPORT_SOURCE_LENGTH = 1_000_000;
const MAX_COLLECTION_ITEM_IMPORT_IMDB_IDS = 100;

const parseYear = (year: string): string | null => {
  const normalizedYear = year
    .trim()
    .replace('–', '-')
    .replace(/^(\d{4})\.0$/, '$1');
  return normalizedYear && normalizedYear !== 'N/A' ? normalizedYear : null;
};

const toCollectionItemFromExternalMetadata = (
  metadataItem: ExternalMetadataItemModel
): CollectionItemChangeApiModel => {
  return {
    image: metadataItem.poster,
    title: metadataItem.title,
    genre: metadataItem.genres,
    IMDbId: getImdbIdFromExternalMetadata(metadataItem),
    externalProvider: metadataItem.provider,
    externalItemId: metadataItem.providerItemId,
    externalIds: metadataItem.externalIds,
    tags: [],
    year: parseYear(metadataItem.year),
    rate: getExternalMetadataRating(metadataItem.ratings, 'Internet Movie Database'),
    rottenTomatoesRate: getExternalMetadataRating(metadataItem.ratings, 'Rotten Tomatoes'),
    metacriticRate: getExternalMetadataRating(metadataItem.ratings, 'Metacritic'),
    userRate: null,
    actors: metadataItem.actors,
    plot: metadataItem.plot,
    contentType: metadataItem.contentType,
    favorite: false,
  };
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/collection-items/imports`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as Partial<CollectionItemsImportApiRequestModel>;
      if (typeof body?.source !== 'string' || body.source.length > MAX_COLLECTION_ITEM_IMPORT_SOURCE_LENGTH) {
        return response.code(400).send();
      }

      const imdbIds = getIMDbIds(body.source);
      if (imdbIds.length > MAX_COLLECTION_ITEM_IMPORT_IMDB_IDS) return response.code(400).send();
      const db = getDatabase();
      const usernameHash = request.usernameHash;
      const provider = getDirectImdbExternalMetadataProvider();
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const imdbId of imdbIds) {
        const canonicalItemId = resolveCanonicalItemId(db, usernameHash, 'imdb', imdbId, [
          { source: 'imdb', id: imdbId },
        ]);
        if (collectionCanonicalItemExists(db, [usernameHash], canonicalItemId)) {
          skippedCount++;
          continue;
        }

        if (provider && collectionItemExistsByExternalId(db, usernameHash, provider.name, imdbId)) {
          skippedCount++;
          continue;
        }

        if (!provider?.getItemByImdbId) {
          errorCount++;
          continue;
        }

        let metadataItem: Awaited<ReturnType<NonNullable<typeof provider.getItemByImdbId>>>;
        try {
          metadataItem = await provider.getItemByImdbId(imdbId);
        } catch {
          errorCount++;
          continue;
        }

        const metadataImdbId = metadataItem ? getImdbIdFromExternalMetadata(metadataItem)?.toLowerCase() : undefined;
        if (!metadataItem || metadataImdbId !== imdbId) {
          errorCount++;
          continue;
        }
        const item = normalizeItem(toCollectionItemFromExternalMetadata(metadataItem));
        if (!item) {
          errorCount++;
          continue;
        }

        const itemCanonicalItemIds = resolveCanonicalItemIds(
          db,
          usernameHash,
          item.externalProvider,
          item.externalItemId,
          item.externalIds
        );
        if (
          itemCanonicalItemIds.some((itemCanonicalItemId) =>
            collectionCanonicalItemExists(db, [usernameHash], itemCanonicalItemId)
          ) ||
          collectionItemExistsByExternalId(db, usernameHash, item.externalProvider, item.externalItemId)
        ) {
          skippedCount++;
          continue;
        }

        insertCollectionItem(db, usernameHash, getItemHash(item), item, 'library');
        importedCount++;
      }

      const result: CollectionItemsImportApiResponseModel = {
        totalCount: imdbIds.length,
        importedCount,
        skippedCount,
        errorCount,
      };
      response.send(result);
    })
  );
};
