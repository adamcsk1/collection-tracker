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
