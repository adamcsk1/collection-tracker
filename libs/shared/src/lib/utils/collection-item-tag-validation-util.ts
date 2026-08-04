import type {
  CollectionItemChangeTagValidationInput,
  CollectionItemCreateTagValidationInput,
  CollectionItemTagValidationError,
} from './collection-item-tag-validation-model';

export const createCollectionItemTagValidation = ({
  contentType,
  favorite,
  listType,
  targetOwnerShareCode,
}: CollectionItemCreateTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (listType !== 'library' && typeof targetOwnerShareCode === 'string') {
    return { kind: 'invalidSharedListCreate' };
  }
  if (listType !== 'library' && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  if (listType === 'watching' && contentType !== 'series') {
    return { kind: 'invalidWatchingTags' };
  }
  if (listType === 'watched' && contentType !== 'movie') {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if ((listType === 'books') !== (contentType === 'book')) {
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
    listType !== 'watching' &&
    listType !== 'watched' &&
    listType !== 'books' &&
    listType !== 'watchlist' &&
    listType !== 'wishlist'
  ) {
    return { kind: 'invalidInternalCollectionItemUpdate' };
  }
  if (listType === 'watching' && (contentType !== 'series' || favorite)) {
    return { kind: 'invalidWatchingTags' };
  }
  if (listType === 'watched' && (contentType !== 'movie' || favorite)) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if ((listType === 'books') !== (contentType === 'book')) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (listType === 'books' && favorite) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (listType === 'watchlist' && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  if (listType === 'wishlist' && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  return undefined;
};

export const filterEditableTags = (tags: readonly string[]): string[] => [...tags];

export const filterDisplayTags = (tags: readonly string[]): string[] => [...tags];
