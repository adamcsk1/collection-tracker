import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { TrackingApiResponseModel } from '@shared/models/api-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { resolveCanonicalItemId } from '../core/database/repositories/external-item-identity-repository';
import { copyBookToCompletedByExternalId } from '../core/database/repositories/tracking-book-repository';
import {
  copyAlbumToCompletedByExternalId,
  copyAlbumToTrackingByExternalId,
} from '../core/database/repositories/tracking-music-repository';
import { copyMovieToCompletedByExternalId } from '../core/database/repositories/tracking-movie-repository';
import { canAccessShare } from '../core/database/repositories/share-repository';
import { copySeriesToTrackingByExternalId } from '../core/database/repositories/tracking-series-repository';
import { replaceTrackingSeasonsByExternalId } from '../core/database/repositories/tracking-season-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { fetchSeriesSeasonMetadata } from '../core/external-metadata/series-season-metadata';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  const handler = withErrorHandler(async (request, response) => {
    const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
    const query = (request.query ?? {}) as Record<string, unknown>;
    if (!isExternalItemIdentitySourceName(externalIdentitySource)) return response.code(400).send();
    const sourceListType = parseListType(query.sourceListType) ?? 'library';
    if (
      sourceListType !== 'up-next' &&
      sourceListType !== 'library' &&
      sourceListType !== 'books' &&
      sourceListType !== 'music'
    ) {
      return response.code(400).send();
    }

    const db = getDatabase();
    const ownerHash =
      typeof query.ownerShareCode === 'string'
        ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
        : request.usernameHash;
    if (!ownerHash) return response.code(404).send();

    const moveFromUpNext = sourceListType === 'up-next';
    const canonicalItemId = resolveCanonicalItemId(db, ownerHash, externalIdentitySource, externalIdentityId);
    const sourceRow =
      findCollectionItemByCanonicalItemId(db, ownerHash, canonicalItemId, sourceListType) ??
      findCollectionItemByExternalId(db, ownerHash, externalIdentitySource, externalIdentityId, sourceListType);
    if (!sourceRow) return response.code(404).send();

    if (
      !canAccessShare(
        db,
        request.usernameHash,
        ownerHash,
        sourceRow.list_type,
        sourceRow.content_type,
        'read',
        sourceRow.id
      )
    ) {
      return response.code(403).send();
    }
    if (moveFromUpNext && ownerHash !== request.usernameHash) return response.code(403).send();

    const markCompleted = query.markCompleted === true || query.markCompleted === 'true';
    const item =
      sourceRow.content_type === 'movie'
        ? copyMovieToCompletedByExternalId(
            db,
            request.usernameHash,
            ownerHash,
            externalIdentitySource,
            externalIdentityId,
            sourceListType,
            moveFromUpNext
          )
        : sourceRow.content_type === 'book' && markCompleted
          ? copyBookToCompletedByExternalId(
              db,
              request.usernameHash,
              ownerHash,
              externalIdentitySource,
              externalIdentityId,
              sourceListType,
              moveFromUpNext
            )
          : sourceRow.content_type === 'album'
            ? (markCompleted ? copyAlbumToCompletedByExternalId : copyAlbumToTrackingByExternalId)(
                db,
                request.usernameHash,
                ownerHash,
                externalIdentitySource,
                externalIdentityId,
                sourceListType,
                moveFromUpNext
              )
            : copySeriesToTrackingByExternalId(
                db,
                request.usernameHash,
                ownerHash,
                externalIdentitySource,
                externalIdentityId,
                sourceListType,
                moveFromUpNext
              );
    if (!item) return response.code(404).send();

    if (item.contentType === 'series') {
      const seasons = await fetchSeriesSeasonMetadata(item.externalProvider, item.externalItemId);
      if (seasons.length) {
        replaceTrackingSeasonsByExternalId(
          db,
          request.usernameHash,
          item.externalProvider,
          item.externalItemId,
          seasons
        );
      }
    }

    const result: TrackingApiResponseModel = { item };
    response.send(result);
  });

  app.post(
    `${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/tracking`,
    { preHandler: jwtGuard },
    handler
  );
};
