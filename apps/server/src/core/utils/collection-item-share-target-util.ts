import { getDatabase } from '../database/database';
import {
  findCollectionItemByCanonicalItemId,
  findCollectionItemByExternalId,
} from '../database/repositories/collection';
import { resolveCanonicalItemId } from '../database/repositories/external-item-identity-repository';
import { parseListType } from './query-parse-util';

export const findOwnedCollectionItemShareTarget = (
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
