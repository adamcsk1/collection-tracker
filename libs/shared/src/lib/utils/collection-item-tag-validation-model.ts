import type { CollectionItemContentTypeModel, CollectionListTypeModel } from '../models/collection-item-model';

export type CollectionItemTagValidationError =
  | { kind: 'invalidInternalCollectionTag' }
  | { kind: 'invalidNonLibraryTag' }
  | { kind: 'invalidTrackingTags' }
  | { kind: 'invalidInternalCollectionItemUpdate' };

export interface CollectionItemCreateTagValidationInput {
  contentType: CollectionItemContentTypeModel;
  favorite: boolean;
  listType: CollectionListTypeModel;
  targetOwnerShareCode?: unknown;
}

export interface CollectionItemChangeTagValidationInput {
  contentType: CollectionItemContentTypeModel;
  favorite: boolean;
  listType: CollectionListTypeModel;
  existingListType: CollectionListTypeModel;
  requesterIsOwner: boolean;
}
