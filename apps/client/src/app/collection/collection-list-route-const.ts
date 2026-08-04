import { CollectionListTypeModel } from '@shared/models/api-model';

/** UI route segment per list_type. */
export const COLLECTION_LIST_ROUTE_BY_TYPE: Record<CollectionListTypeModel, string> = {
  library: 'library',
  wishlist: 'wishlist',
  watchlist: 'watchlist',
  watching: 'watching',
  watched: 'watched',
  books: 'books',
};

export const COLLECTION_LIST_TYPE_BY_ROUTE: Record<string, CollectionListTypeModel> = {
  library: 'library',
  wishlist: 'wishlist',
  watchlist: 'watchlist',
  watching: 'watching',
  watched: 'watched',
  books: 'books',
};

/** i18n key for nav / header titles by list_type */
export const COLLECTION_LIST_TITLE_KEY_BY_TYPE: Record<CollectionListTypeModel, string> = {
  library: 'Collection',
  wishlist: 'Wishlist',
  watchlist: 'Watchlist',
  watching: 'Watching',
  watched: 'Watched',
  books: 'Books',
};
