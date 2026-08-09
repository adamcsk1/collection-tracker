import type { SharePermission } from '@shared/models/share-grant-model';
import Database from 'better-sqlite3';
import { findCollectionItemByExternalIdOrCanonicalItemId } from '../database/repositories/collection';
import type { CollectionItemRow } from '../database/repositories/collection/collection-model';
import { canAccessShare } from '../database/repositories/share-repository';
import { findUserByShareCode } from '../database/repositories/user-repository';

type TrackingSeriesTargetResult = { status: 200; ownerHash: string; item: CollectionItemRow } | { status: 403 | 404 };

export const resolveTrackingSeriesTarget = (
  db: Database.Database,
  accessorHash: string,
  ownerShareCode: unknown,
  externalProvider: string,
  externalItemId: string,
  permission: SharePermission
): TrackingSeriesTargetResult => {
  const ownerHash =
    typeof ownerShareCode === 'string' ? findUserByShareCode(db, ownerShareCode)?.username_hash : accessorHash;
  if (!ownerHash) return { status: 404 };

  const item = findCollectionItemByExternalIdOrCanonicalItemId(
    db,
    ownerHash,
    externalProvider,
    externalItemId,
    'tracking'
  );
  if (!item || item.list_type !== 'tracking' || item.content_type !== 'series') return { status: 404 };

  if (!canAccessShare(db, accessorHash, ownerHash, item.list_type, item.content_type, permission)) {
    return { status: 403 };
  }

  return { status: 200, ownerHash, item };
};
