import { API_PREFIX } from '@shared/constants/api-const';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../core/database/database';
import { findCollectionItemShares } from '../core/database/repositories/share-repository';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { findOwnedCollectionItemShareTarget } from '../core/utils/collection-item-share-target-util';
import { parseListType } from '../core/utils/query-parse-util';

export const register = (app: FastifyInstance): void => {
  app.get(
    `${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/shares`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const { externalIdentitySource, externalIdentityId } = request.params as Record<string, string>;
      if (!isExternalItemIdentitySourceName(externalIdentitySource) || !externalIdentityId?.trim()) {
        return response.code(400).send();
      }
      const query = (request.query ?? {}) as Record<string, unknown>;
      const listType = parseListType(query.listType);
      if (query.listType !== undefined && !listType) return response.code(400).send();
      const item = findOwnedCollectionItemShareTarget(
        request.usernameHash,
        externalIdentitySource,
        externalIdentityId,
        listType
      );
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
};
