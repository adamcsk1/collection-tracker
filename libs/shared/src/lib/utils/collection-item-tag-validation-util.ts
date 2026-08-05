import type {
  CollectionItemChangeTagValidationInput,
  CollectionItemCreateTagValidationInput,
  CollectionItemTagValidationError,
} from './collection-item-tag-validation-model';

const isOwnershipList = (listType: string): boolean => listType === 'library' || listType === 'books';

const isBookAllowedOnList = (listType: string): boolean =>
  listType === 'books' || listType === 'wishlist' || listType === 'watchlist' || listType === 'tracking';

const contentTypeAllowedOnList = (listType: string, contentType: string): boolean => {
  if (listType === 'library') return contentType === 'movie' || contentType === 'series';
  if (listType === 'books') return contentType === 'book';
  if (listType === 'tracking') return contentType === 'movie' || contentType === 'series' || contentType === 'book';
  if (listType === 'wishlist' || listType === 'watchlist') {
    return contentType === 'movie' || contentType === 'series' || contentType === 'book';
  }
  return false;
};

export const createCollectionItemTagValidation = ({
  contentType,
  favorite,
  listType,
  targetOwnerShareCode,
}: CollectionItemCreateTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (listType !== 'library' && typeof targetOwnerShareCode === 'string') {
    return { kind: 'invalidSharedListCreate' };
  }
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
  requesterIsOwner,
}: CollectionItemChangeTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (existingListType !== 'library' && !requesterIsOwner) {
    return { kind: 'sharedInternalCollectionItemUpdate' };
  }
  if (
    existingListType !== 'library' &&
    listType !== 'tracking' &&
    listType !== 'books' &&
    listType !== 'watchlist' &&
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
