import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { WatchingApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { canAccessLibrary } from '../core/database/repositories/share-repository';
import { copySeriesToWatchingByExternalId } from '../core/database/repositories/series-tracker-repository';
import { replaceWatchingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    const query = (request.query ?? {}) as Record<string, unknown>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const sourceListType = parseListType(query.sourceListType) ?? 'library';
    if (sourceListType !== 'watchlist' && sourceListType !== 'library') return response.code(400).send();

    const db = getDatabase();
    const ownerHash =
      sourceListType === 'library' && typeof query.ownerShareCode === 'string'
        ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
        : request.usernameHash;
    if (!ownerHash) return response.code(404).send();

    if (sourceListType === 'library' && !canAccessLibrary(db, request.usernameHash, ownerHash, 'read')) {
      return response.code(403).send();
    }

    const item = copySeriesToWatchingByExternalId(
      db,
      request.usernameHash,
      ownerHash,
      externalIdentitySource,
      externalIdentityId,
      sourceListType,
      sourceListType === 'watchlist'
    );
    if (!item) return response.code(404).send();

    const seasons = await fetchSeriesSeasonMetadata(item.externalProvider, item.externalItemId);
    if (seasons.length) {
      replaceWatchingSeasonsByExternalId(db, request.usernameHash, item.externalProvider, item.externalItemId, seasons);
    }

    const result: WatchingApiResponseModel = { item };
    response.send(result);
  });

  app.post(`${API_PREFIX}/watching/:externalIdentitySource/:externalIdentityId`, { preHandler: jwtGuard }, handler);
};
