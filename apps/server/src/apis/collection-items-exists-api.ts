import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  collectionCanonicalItemExistsInList,
  collectionExternalItemExistsInList,
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import {
  normalizeExternalIdentities,
  resolveCanonicalItemId,
} from '../core/database/repositories/external-item-identity-repository';
import { canAccessShare } from '../core/database/repositories/share-repository';
import { findUserByShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/exists`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const query = request.query as Record<string, unknown>;
      const externalIdentitySource =
        typeof query.externalIdentitySource === 'string' ? query.externalIdentitySource.trim() : '';
      const externalIdentityId = typeof query.externalIdentityId === 'string' ? query.externalIdentityId.trim() : '';
      const externalIds = parseExternalIds(query.externalIds);
      const hasExternalIdentity = !!externalIdentitySource && !!externalIdentityId;
      const hasPartialExternalIdentity = (externalIdentitySource || externalIdentityId) && !hasExternalIdentity;
      if (
        externalIds === null ||
        hasPartialExternalIdentity ||
        !hasExternalIdentity ||
        !isExternalItemIdentitySourceName(externalIdentitySource)
      ) {
        response.code(400).send();
        return;
      }
      const listType = parseListType(query.listType) ?? 'library';

      const db = getDatabase();
      const targetOwnerHash =
        typeof query.ownerShareCode === 'string'
          ? findUserByShareCode(db, query.ownerShareCode)?.username_hash
          : request.usernameHash;
      if (!targetOwnerHash) {
        response.code(404).send();
        return;
      }

      const canonicalItemId = resolveCanonicalItemId(
        db,
        targetOwnerHash,
        externalIdentitySource,
        externalIdentityId,
        externalIds
      );
      const existingItem =
        findCollectionItemByCanonicalItemId(db, targetOwnerHash, canonicalItemId, listType) ??
        findCollectionItemByExternalId(db, targetOwnerHash, externalIdentitySource, externalIdentityId, listType);

      if (
        existingItem &&
        !canAccessShare(
          db,
          request.usernameHash,
          targetOwnerHash,
          existingItem.list_type,
          existingItem.content_type,
          'read',
          existingItem.id
        )
      ) {
        response.code(403).send();
        return;
      }

      if (
        !existingItem &&
        targetOwnerHash !== request.usernameHash &&
        !canAccessShare(db, request.usernameHash, targetOwnerHash, listType, 'movie', 'read') &&
        !canAccessShare(db, request.usernameHash, targetOwnerHash, listType, 'series', 'read') &&
        !canAccessShare(db, request.usernameHash, targetOwnerHash, listType, 'book', 'read') &&
        !canAccessShare(db, request.usernameHash, targetOwnerHash, listType, 'album', 'read')
      ) {
        response.code(403).send();
        return;
      }

      const exists = existingItem
        ? true
        : collectionCanonicalItemExistsInList(db, [targetOwnerHash], canonicalItemId, listType) ||
          collectionExternalItemExistsInList(
            db,
            [targetOwnerHash],
            externalIdentitySource,
            externalIdentityId,
            listType
          );

      response.send({
        exists,
        hash: exists ? existingItem?.content_hash : undefined,
      });
    })
  );
};

const parseExternalIds = (value: unknown): ExternalItemIdentityModel[] | null => {
  if (value === undefined) return [];
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      if (!Array.isArray(parsed)) return null;
      if (
        parsed.some(
          (entry) =>
            typeof entry !== 'object' ||
            entry === null ||
            typeof (entry as { source?: unknown }).source !== 'string' ||
            typeof (entry as { id?: unknown }).id !== 'string'
        )
      ) {
        return null;
      }
      return normalizeExternalIdentities(
        '',
        '',
        parsed.map((entry) => ({
          source: (entry as { source: string }).source,
          id: (entry as { id: string }).id,
        }))
      ).filter((identity) => identity.source && identity.id);
    } catch {
      return null;
    }
  }
  return null;
};
