import { CollectionListTypeModel } from '../models/collection-item-model';

export const COLLECTION_LIST_TYPES: readonly CollectionListTypeModel[] = [
  'library',
  'wishlist',
  'up-next',
  'tracking',
  'books',
  'music',
] as const;
