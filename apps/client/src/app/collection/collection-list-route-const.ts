import { CollectionListTypeModel } from '@shared/models/api-model';

/** UI route segment per list_type. */
export const COLLECTION_LIST_ROUTE_BY_TYPE: Record<CollectionListTypeModel, string> = {
  library: 'library',
  wishlist: 'wishlist',
  'up-next': 'up-next',
  tracking: 'tracking',
  books: 'books',
  music: 'music',
};

export const COLLECTION_LIST_TYPE_BY_ROUTE: Record<string, CollectionListTypeModel> = {
  library: 'library',
  wishlist: 'wishlist',
  'up-next': 'up-next',
  watchlist: 'up-next',
  'watch-later': 'up-next',
  tracking: 'tracking',
  finished: 'tracking',
  books: 'books',
  music: 'music',
};

/** i18n key for nav / header titles by list_type */
export const COLLECTION_LIST_TITLE_KEY_BY_TYPE: Record<CollectionListTypeModel, string> = {
  library: 'Collection',
  wishlist: 'Wishlist',
  'up-next': 'UpNext',
  tracking: 'Tracking',
  books: 'Books',
  music: 'Music',
};
