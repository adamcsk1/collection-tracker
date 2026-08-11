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
      readMode: 'all',
    },
    {
      listType: 'library',
      contentType: 'series',
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      readMode: 'all',
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

export const insertShareTestUser = (database: Database.Database, usernameHash: string): void => {
  database
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, usernameHash);
};

export const insertShareTestCollectionItem = (
  database: Database.Database,
  ownerHash: string,
  externalItemId: string,
  listType: 'library' | 'books' = 'library',
  contentType: 'movie' | 'book' = 'movie'
): number => {
  const externalProvider = contentType === 'book' ? 'openlibrary' : 'imdb';
  const result = database
    .prepare(
      `INSERT INTO collection_items
       (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
        title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', ?)`
    )
    .run(
      ownerHash,
      externalProvider,
      externalItemId,
      `${externalProvider}:${externalItemId}`,
      listType,
      contentType,
      externalItemId,
      externalItemId,
      `${externalItemId}-hash`
    );
  return Number(result.lastInsertRowid);
};
