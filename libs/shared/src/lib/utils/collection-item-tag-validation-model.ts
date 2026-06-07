import type { CollectionListTypeModel } from '../models/collection-item-model';

export type CollectionItemTagValidationError =
  | { kind: 'usedInternalTag' }
  | { kind: 'virtualTag' }
  | { kind: 'invalidInternalCollectionTag' }
  | { kind: 'missingTypeTag' }
  | { kind: 'invalidNonLibraryTag' }
  | { kind: 'invalidSeriesTrackerTags' }
  | { kind: 'invalidSharedListCreate' }
  | { kind: 'invalidInternalCollectionItemUpdate' }
  | { kind: 'sharedInternalCollectionItemUpdate' };

export interface CollectionItemCreateTagValidationInput {
  tags: readonly string[];
  listType: CollectionListTypeModel;
  targetOwnerShareCode?: unknown;
}

export interface CollectionItemChangeTagValidationInput {
  tags: readonly string[];
  listType: CollectionListTypeModel;
  existingListType: CollectionListTypeModel;
  requesterIsOwner: boolean;
}
