import { CollectionListTypeModel } from '../models/collection-item-model';

export const COLLECTION_LIST_TYPES: readonly CollectionListTypeModel[] = [
  'library',
  'wishlist',
  'watchlist',
  'watching',
  'watched',
  'books',
] as const;

export const parseCollectionListType = (value: unknown): CollectionListTypeModel | undefined => {
  if (typeof value !== 'string') return undefined;
  if ((COLLECTION_LIST_TYPES as readonly string[]).includes(value)) {
    return value as CollectionListTypeModel;
  }
  return undefined;
};
