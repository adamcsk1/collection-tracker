import { CollectionListTypeModel } from '../models/collection-item-model';

export const COLLECTION_LIST_TYPES: readonly CollectionListTypeModel[] = [
  'library',
  'wishlist',
  'up-next',
  'tracking',
  'books',
] as const;

/** Legacy list_type values rewritten to current types (migration / older payloads). */
export const LEGACY_COLLECTION_LIST_TYPE_MAP: Readonly<Record<string, CollectionListTypeModel>> = {
  'watch-later': 'up-next',
  watchlist: 'up-next',
  'series-tracker': 'tracking',
  'movie-tracker': 'tracking',
  'book-tracker': 'books',
  watching: 'tracking',
  watched: 'tracking',
  finished: 'tracking',
};
