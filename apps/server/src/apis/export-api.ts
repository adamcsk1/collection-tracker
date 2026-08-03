import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { API_PREFIX } from '@shared/constants/api-const';
import { EXPORT_TYPE, EXPORT_VERSION } from '@shared/constants/export-import-const';
import { getDatabase } from '../core/database/database';
import { findUserSettings } from '../core/database/repositories/user-repository';
import { findTagManagement } from '../core/database/repositories/tag-management-repository';
import { findAllCollectionItemsByUser } from '../core/database/repositories/collection/collection-read-repository';
import {
  inferCanonicalItemId,
  pickStrongerCanonicalItemId,
} from '../core/database/repositories/external-item-identity-repository';
import { findSeriesTrackerSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { findWatchedEpisodesByExternalId } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { CollectionItemApiModel, UserExportApiResponseModel } from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import type { FastifyInstance } from 'fastify';

const getSeriesTrackerDataKey = (externalProvider: string, externalItemId: string): string =>
  `${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}`;

const toExportCollectionItem = (item: CollectionItemApiModel): CollectionItemApiModel => {
  const externalIds: ExternalItemIdentityModel[] = [];
  const addIdentity = (source: string, id: string): void => {
    if (!id || !isExternalItemIdentitySourceName(source)) return;
    externalIds.push({ source, id });
  };
  for (const identity of item.externalIds ?? []) addIdentity(identity.source, identity.id);
  addIdentity(item.externalProvider, item.externalItemId);
  if (item.IMDbId) addIdentity('imdb', item.IMDbId);
  const uniqueExternalIds = [
    ...new Map(externalIds.map((identity) => [`${identity.source}\u0000${identity.id}`, identity])).values(),
  ];
  const inferredCanonicalItemId = uniqueExternalIds.length
    ? inferCanonicalItemId(uniqueExternalIds)
    : item.externalProvider && item.externalItemId
      ? `${item.externalProvider}:${item.externalItemId}`
      : undefined;
  const canonicalItemId =
    item.canonicalItemId && inferredCanonicalItemId
      ? pickStrongerCanonicalItemId(item.canonicalItemId, inferredCanonicalItemId)
      : (item.canonicalItemId ?? inferredCanonicalItemId);

  return {
    ...item,
    externalIds: uniqueExternalIds.length ? uniqueExternalIds : undefined,
    canonicalItemId,
  };
};

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/export`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const db = getDatabase();
      const usernameHash = request.usernameHash;

      const userSettings = findUserSettings(db, usernameHash) ?? {};
      const tagManagement = findTagManagement(db, usernameHash);
      const collectionItems = findAllCollectionItemsByUser(db, usernameHash).map(toExportCollectionItem);

      const seriesTrackerData: UserExportApiResponseModel['seriesTrackerData'] = {};
      for (const item of collectionItems) {
        if (item.listType === 'series-tracker') {
          const seriesTrackerDataKey = getSeriesTrackerDataKey(item.externalProvider, item.externalItemId);
          seriesTrackerData[seriesTrackerDataKey] = {
            seasons: findSeriesTrackerSeasonsByExternalId(db, usernameHash, item.externalProvider, item.externalItemId),
            watchedEpisodes: findWatchedEpisodesByExternalId(
              db,
              usernameHash,
              item.externalProvider,
              item.externalItemId
            ),
          };
        }
      }

      const result: UserExportApiResponseModel = {
        type: EXPORT_TYPE,
        version: EXPORT_VERSION,
        userSettings,
        collectionItems,
        tagManagement,
        seriesTrackerData,
      };

      response.send(result);
    })
  );
};
