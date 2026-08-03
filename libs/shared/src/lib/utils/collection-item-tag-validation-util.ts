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
  if (listType === 'series-tracker' && contentType !== 'series') {
    return { kind: 'invalidSeriesTrackerTags' };
  }
  if (listType === 'movie-tracker' && contentType !== 'movie') {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if ((listType === 'book-tracker') !== (contentType === 'book')) {
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
    listType !== 'series-tracker' &&
    listType !== 'movie-tracker' &&
    listType !== 'book-tracker' &&
    listType !== 'watch-later' &&
    listType !== 'wishlist'
  ) {
    return { kind: 'invalidInternalCollectionItemUpdate' };
  }
  if (listType === 'series-tracker' && (contentType !== 'series' || favorite)) {
    return { kind: 'invalidSeriesTrackerTags' };
  }
  if (listType === 'movie-tracker' && (contentType !== 'movie' || favorite)) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if ((listType === 'book-tracker') !== (contentType === 'book')) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (listType === 'book-tracker' && favorite) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  if (listType === 'watch-later' && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  if (listType === 'wishlist' && favorite) {
    return { kind: 'invalidNonLibraryTag' };
  }
  return undefined;
};

export const filterEditableTags = (tags: readonly string[]): string[] => [...tags];

export const filterDisplayTags = (tags: readonly string[]): string[] => [...tags];
