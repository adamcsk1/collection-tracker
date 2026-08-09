import type { UserShareGrantApiModel } from '@shared/models/api-model';
import { defaultLibraryReadGrants } from '@shared/utils/share-grant-util';
import Database from 'better-sqlite3';
import { upsertShare } from '../../src/core/database/repositories/share-repository';

export const libraryGrants = (
  permissions: Partial<Pick<UserShareGrantApiModel, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>> = {}
): UserShareGrantApiModel[] => {
  const canCreate = permissions.canCreate === true;
  const canUpdate = permissions.canUpdate === true;
  const canDelete = permissions.canDelete === true;
  const canRead = permissions.canRead === true || canCreate || canUpdate || canDelete;

  return [
    {
      listType: 'library',
      contentType: 'movie',
      canRead,
      canCreate,
      canUpdate,
      canDelete,
    },
    {
      listType: 'library',
      contentType: 'series',
      canRead,
      canCreate,
      canUpdate,
      canDelete,
    },
  ];
};

export const insertShare = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string,
  grants: UserShareGrantApiModel[] = defaultLibraryReadGrants()
): void => {
  upsertShare(db, ownerHash, sharedWithHash, grants);
};

export const insertLibraryShare = (
  db: Database.Database,
  ownerHash: string,
  sharedWithHash: string,
  permissions: Partial<Pick<UserShareGrantApiModel, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>> = {
    canRead: true,
  }
): void => {
  insertShare(db, ownerHash, sharedWithHash, libraryGrants(permissions));
};
