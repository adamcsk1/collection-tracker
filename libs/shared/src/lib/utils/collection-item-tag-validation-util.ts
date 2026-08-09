import type {
  CollectionItemChangeTagValidationInput,
  CollectionItemCreateTagValidationInput,
  CollectionItemTagValidationError,
} from './collection-item-tag-validation-model';
import { contentTypeAllowedOnList } from './share-grant-util';

const isOwnershipList = (listType: string): boolean => listType === 'library' || listType === 'books';

const isBookAllowedOnList = (listType: string): boolean =>
  listType === 'books' || listType === 'wishlist' || listType === 'up-next' || listType === 'tracking';

export const createCollectionItemTagValidation = ({
  contentType,
  favorite,
  listType,
}: CollectionItemCreateTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (!isOwnershipList(listType) && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  if (!contentTypeAllowedOnList(listType, contentType)) {
    if (listType === 'tracking') return { kind: 'invalidTrackingTags' };
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (contentType === 'book' && !isBookAllowedOnList(listType)) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  return undefined;
};

export const changeCollectionItemTagValidation = ({
  contentType,
  favorite,
  listType,
  existingListType,
}: CollectionItemChangeTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (
    existingListType !== 'library' &&
    listType !== 'tracking' &&
    listType !== 'books' &&
    listType !== 'up-next' &&
    listType !== 'wishlist'
  ) {
    return { kind: 'invalidInternalCollectionItemUpdate' };
  }
  if (!contentTypeAllowedOnList(listType, contentType)) {
    if (listType === 'tracking') return { kind: 'invalidTrackingTags' };
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (!isOwnershipList(listType) && favorite) {
    if (listType === 'tracking') return { kind: 'invalidTrackingTags' };
    return { kind: 'invalidNonLibraryTag' };
  }
  return undefined;
};

export const filterEditableTags = (tags: readonly string[]): string[] => [...tags];

export const filterDisplayTags = (tags: readonly string[]): string[] => [...tags];
