import { API_PREFIX } from '@shared/constants/api-const';
import type {
  CollectionItemShareSelectionApiModel,
  CollectionItemShareSelectionPermissionsApiModel,
} from '@shared/models/api-model';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../core/database/repositories/collection';
import { resolveCanonicalItemId } from '../core/database/repositories/external-item-identity-repository';
import {
  findCollectionItemShares,
  hasUserShareRelationship,
  replaceCollectionItemSelections,
} from '../core/database/repositories/share-repository';
import { findUserByShareCode, getUserShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { parseListType } from '../core/utils/query-parse-util';

const hasOnlyKeys = (value: object, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const isPermissions = (value: unknown): value is CollectionItemShareSelectionPermissionsApiModel =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  hasOnlyKeys(value, ['canRead', 'canCreate', 'canUpdate', 'canDelete']) &&
  (value as CollectionItemShareSelectionPermissionsApiModel).canRead === true &&
  typeof (value as CollectionItemShareSelectionPermissionsApiModel).canCreate === 'boolean' &&
  typeof (value as CollectionItemShareSelectionPermissionsApiModel).canUpdate === 'boolean' &&
  typeof (value as CollectionItemShareSelectionPermissionsApiModel).canDelete === 'boolean';

const isSelectionArray = (value: unknown): value is CollectionItemShareSelectionApiModel[] =>
  Array.isArray(value) &&
  value.every(
    (selection) =>
      typeof selection === 'object' &&
      selection !== null &&
      !Array.isArray(selection) &&
      hasOnlyKeys(selection, ['sharedWithUserShareCode', 'permissions']) &&
      typeof selection.sharedWithUserShareCode === 'string' &&
      !!selection.sharedWithUserShareCode.trim() &&
      (selection.permissions === undefined || isPermissions(selection.permissions))
  );

const findOwnedItem = (
  ownerHash: string,
  externalIdentitySource: string,
  externalIdentityId: string,
  listType: ReturnType<typeof parseListType>
) => {
  const db = getDatabase();
  const effectiveListType = listType ?? 'library';
  const canonicalItemId = resolveCanonicalItemId(db, ownerHash, externalIdentitySource, externalIdentityId);
  return (
    findCollectionItemByCanonicalItemId(db, ownerHash, canonicalItemId, effectiveListType) ??
    findCollectionItemByExternalId(db, ownerHash, externalIdentitySource, externalIdentityId, effectiveListType)
  );
};

export const register = (app: FastifyInstance): void => {
  const route = `${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/shares`;

  app.get(
    route,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      if (!isExternalItemIdentitySourceName(externalIdentitySource) || !externalIdentityId?.trim()) {
        return response.code(400).send();
      }
      const query = (request.query ?? {}) as Record<string, unknown>;
      const listType = parseListType(query.listType);
      if (query.listType !== undefined && !listType) return response.code(400).send();
      const item = findOwnedItem(request.usernameHash, externalIdentitySource, externalIdentityId, listType);
      if (!item) return response.code(404).send();

      const data = findCollectionItemShares(getDatabase(), request.usernameHash, item).map((share) => ({
        sharedWithUserShareCode: getUserShareCode(share.sharedWithUsernameHash),
        sharedWithUsername: share.sharedWithUsername,
        readMode: share.readMode,
        permissions: share.permissions,
      }));
      response.send(data);
    })
  );

  app.put(
    route,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      const body = request.body as { selections?: unknown } | undefined;
      if (
        !isExternalItemIdentitySourceName(externalIdentitySource) ||
        !externalIdentityId?.trim() ||
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        !hasOnlyKeys(body, ['selections']) ||
        !isSelectionArray(body.selections)
      ) {
        return response.code(400).send();
      }
      const query = (request.query ?? {}) as Record<string, unknown>;
      const listType = parseListType(query.listType);
      if (query.listType !== undefined && !listType) return response.code(400).send();
      const item = findOwnedItem(request.usernameHash, externalIdentitySource, externalIdentityId, listType);
      if (!item) return response.code(404).send();

      const recipients = [];
      const recipientHashes = new Set<string>();
      for (const selection of body.selections) {
        const recipient = findUserByShareCode(getDatabase(), selection.sharedWithUserShareCode.trim());
        if (!recipient || recipient.username_hash === request.usernameHash) return response.code(404).send();
        if (recipientHashes.has(recipient.username_hash)) return response.code(400).send();
        recipientHashes.add(recipient.username_hash);
        if (!hasUserShareRelationship(getDatabase(), request.usernameHash, recipient.username_hash)) {
          return response.code(404).send();
        }
        recipients.push({ sharedWithUsernameHash: recipient.username_hash, permissions: selection.permissions });
      }

      try {
        replaceCollectionItemSelections(getDatabase(), request.usernameHash, item, recipients);
      } catch (error) {
        if (error instanceof Error && error.message === 'BROAD_SHARE_SELECTION') return response.code(409).send();
        if (error instanceof Error && error.message === 'MISSING_SHARE_PERMISSIONS') return response.code(400).send();
        throw error;
      }
      response.code(204).send();
    })
  );
};
