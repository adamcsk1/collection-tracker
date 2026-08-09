import { COLLECTION_LIST_TYPES, LEGACY_COLLECTION_LIST_TYPE_MAP } from '../constants/collection-list-type-const';
import { CollectionListTypeModel } from '../models/collection-item-model';

export const parseCollectionListType = (value: unknown): CollectionListTypeModel | undefined => {
  if (typeof value !== 'string') return undefined;
  if ((COLLECTION_LIST_TYPES as readonly string[]).includes(value)) {
    return value as CollectionListTypeModel;
  }
  return LEGACY_COLLECTION_LIST_TYPE_MAP[value];
};
