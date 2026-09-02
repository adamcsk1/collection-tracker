import type { CollectionItemContentTypeModel, CollectionListTypeModel } from '../models/collection-item-model';
import type { UserShareGrantApiModel } from '../models/api-model';
import type { SharePermission, ShareScope } from '../models/share-grant-model';
import { COLLECTION_LIST_TYPES } from '../constants/collection-list-type-const';

const CONTENT_TYPES: readonly CollectionItemContentTypeModel[] = ['movie', 'series', 'book', 'album'];

export const contentTypeAllowedOnList = (
  listType: CollectionListTypeModel | string,
  contentType: CollectionItemContentTypeModel | string
): boolean => {
  if (listType === 'library') return contentType === 'movie' || contentType === 'series';
  if (listType === 'books') return contentType === 'book';
  if (listType === 'music') return contentType === 'album';
  if (listType === 'tracking' || listType === 'wishlist' || listType === 'up-next') {
    return contentType === 'movie' || contentType === 'series' || contentType === 'book' || contentType === 'album';
  }
  return false;
};

export const SHAREABLE_SCOPES: readonly ShareScope[] = COLLECTION_LIST_TYPES.flatMap((listType) =>
  CONTENT_TYPES.filter((contentType) => contentTypeAllowedOnList(listType, contentType)).map((contentType) => ({
    listType,
    contentType,
  }))
);

export const isValidShareScope = (listType: unknown, contentType: unknown): listType is CollectionListTypeModel =>
  typeof listType === 'string' && typeof contentType === 'string' && contentTypeAllowedOnList(listType, contentType);

export const normalizeShareGrant = (grant: UserShareGrantApiModel): UserShareGrantApiModel | undefined => {
  if (!isValidShareScope(grant.listType, grant.contentType)) return undefined;

  const canCreate = grant.canCreate === true;
  const canUpdate = grant.canUpdate === true;
  const canDelete = grant.canDelete === true;
  const canRead = grant.canRead === true || canCreate || canUpdate || canDelete;

  if (!canRead && !canCreate && !canUpdate && !canDelete) return undefined;

  return {
    listType: grant.listType,
    contentType: grant.contentType,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    readMode: grant.readMode,
  };
};

export const normalizeShareGrants = (grants: readonly UserShareGrantApiModel[]): UserShareGrantApiModel[] => {
  const byScope = new Map<string, UserShareGrantApiModel>();

  for (const grant of grants) {
    const normalized = normalizeShareGrant(grant);
    if (!normalized) continue;
    byScope.set(`${normalized.listType}:${normalized.contentType}`, normalized);
  }

  return [...byScope.values()].sort((left, right) => {
    const listCompare = left.listType.localeCompare(right.listType);
    if (listCompare !== 0) return listCompare;
    return left.contentType.localeCompare(right.contentType);
  });
};

export const hasSharePermission = (
  grants: readonly UserShareGrantApiModel[],
  listType: CollectionListTypeModel,
  contentType: CollectionItemContentTypeModel,
  permission: SharePermission
): boolean => {
  const grant = grants.find((entry) => entry.listType === listType && entry.contentType === contentType);
  if (!grant) return false;
  switch (permission) {
    case 'read':
      return grant.canRead;
    case 'create':
      return grant.canCreate;
    case 'update':
      return grant.canUpdate;
    case 'delete':
      return grant.canDelete;
    default:
      return false;
  }
};

export const defaultLibraryReadGrants = (): UserShareGrantApiModel[] => [
  {
    listType: 'library',
    contentType: 'movie',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    readMode: 'all',
  },
  {
    listType: 'library',
    contentType: 'series',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    readMode: 'all',
  },
];
