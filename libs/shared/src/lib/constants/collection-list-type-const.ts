import { CollectionListTypeModel } from '../models/collection-item-model';

export const COLLECTION_LIST_TYPES: readonly CollectionListTypeModel[] = [
  'library',
  'wishlist',
  'watchlist',
  'tracking',
  'books',
] as const;

/** Legacy list_type values rewritten to current types (migration / older payloads). */
export const LEGACY_COLLECTION_LIST_TYPE_MAP: Readonly<Record<string, CollectionListTypeModel>> = {
  'watch-later': 'watchlist',
  'series-tracker': 'tracking',
  'movie-tracker': 'tracking',
  'book-tracker': 'books',
  watching: 'tracking',
  watched: 'tracking',
  finished: 'tracking',
};

export const parseCollectionListType = (value: unknown): CollectionListTypeModel | undefined => {
  if (typeof value !== 'string') return undefined;
  if ((COLLECTION_LIST_TYPES as readonly string[]).includes(value)) {
    return value as CollectionListTypeModel;
  }
  return LEGACY_COLLECTION_LIST_TYPE_MAP[value];
};
