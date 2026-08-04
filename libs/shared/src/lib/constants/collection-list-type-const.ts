import { CollectionListTypeModel } from '../models/collection-item-model';

export const COLLECTION_LIST_TYPES: readonly CollectionListTypeModel[] = [
  'library',
  'wishlist',
  'watchlist',
  'tracking',
  'finished',
  'books',
] as const;

/** Legacy list_type values accepted on import / older clients. */
export const LEGACY_COLLECTION_LIST_TYPE_MAP: Readonly<Record<string, CollectionListTypeModel>> = {
  'watch-later': 'watchlist',
  'series-tracker': 'tracking',
  'movie-tracker': 'finished',
  'book-tracker': 'books',
  watching: 'tracking',
  watched: 'finished',
};

export const parseCollectionListType = (value: unknown): CollectionListTypeModel | undefined => {
  if (typeof value !== 'string') return undefined;
  if ((COLLECTION_LIST_TYPES as readonly string[]).includes(value)) {
    return value as CollectionListTypeModel;
  }
  return LEGACY_COLLECTION_LIST_TYPE_MAP[value];
};
