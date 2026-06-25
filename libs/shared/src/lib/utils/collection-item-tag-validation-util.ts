import {
  COMPLETED_TAG,
  FAVORITE_TAG,
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '../constants/tags-const';
import type {
  CollectionItemChangeTagValidationInput,
  CollectionItemCreateTagValidationInput,
  CollectionItemTagValidationError,
} from './collection-item-tag-validation-model';
import { parseTagText } from './collection-item-text-util';

const INTERNAL_COLLECTION_TAGS = [WATCH_LATER_TAG, WISHLIST_TAG];
const TYPE_TAGS = [MOVIE_TAG, SERIES_TAG];
const FORBIDDEN_NON_LIBRARY_TAGS = [FAVORITE_TAG];
const USER_ACTION_TAGS = [FAVORITE_TAG];
const SERVER_MANAGED_TAGS = [COMPLETED_TAG];
const EDITOR_HIDDEN_TAGS = [...INTERNAL_COLLECTION_TAGS, ...USER_ACTION_TAGS, ...SERVER_MANAGED_TAGS];
const EDITOR_PRESERVED_TAGS = [...INTERNAL_COLLECTION_TAGS, FAVORITE_TAG];
const EPISODE_PROGRESS_TAG_PATTERN = /^#episode-s(\d{2})e(\d{2})$/;

export const forbiddenEpisodeProgressTagValidation = (
  tags: readonly string[]
): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => EPISODE_PROGRESS_TAG_PATTERN.test(tag)) ? { kind: 'invalidSeriesTrackerTags' } : undefined;
};

export const forbiddenInternalTagTextValidation = (
  tagText: string | null
): CollectionItemTagValidationError | undefined => {
  const tags = parseTagText(tagText ?? '');
  return tags.some((tag) => VIRTUAL_TAGS.includes(tag) || INTERNAL_USED_TAGS.includes(tag))
    ? { kind: 'usedInternalTag' }
    : undefined;
};

export const virtualTagValidation = (tags: readonly string[]): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => VIRTUAL_TAGS.includes(tag)) ? { kind: 'virtualTag' } : undefined;
};

export const serverManagedTagValidation = (tags: readonly string[]): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => SERVER_MANAGED_TAGS.includes(tag)) ? { kind: 'usedInternalTag' } : undefined;
};

export const userActionTagValidation = (tags: readonly string[]): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => USER_ACTION_TAGS.includes(tag)) ? { kind: 'usedInternalTag' } : undefined;
};

export const invalidInternalCollectionTagValidation = (
  tags: readonly string[]
): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => INTERNAL_COLLECTION_TAGS.includes(tag))
    ? { kind: 'invalidInternalCollectionTag' }
    : undefined;
};

export const typeTagValidation = (tags: readonly string[]): CollectionItemTagValidationError | undefined => {
  return tags.some((tag) => TYPE_TAGS.includes(tag)) ? undefined : { kind: 'missingTypeTag' };
};

export const collectionItemTagValidation = (tags: readonly string[]): CollectionItemTagValidationError | undefined => {
  return (
    virtualTagValidation(tags) ??
    serverManagedTagValidation(tags) ??
    invalidInternalCollectionTagValidation(tags) ??
    forbiddenEpisodeProgressTagValidation(tags) ??
    typeTagValidation(tags)
  );
};

export const createCollectionItemTagValidation = ({
  tags,
  listType,
  targetOwnerShareCode,
}: CollectionItemCreateTagValidationInput): CollectionItemTagValidationError | undefined => {
  const tagValidation = collectionItemTagValidation(tags);
  if (tagValidation) return tagValidation;
  if (listType !== 'library' && typeof targetOwnerShareCode === 'string') {
    return { kind: 'invalidSharedListCreate' };
  }
  if (listType !== 'library' && tags.some((tag) => FORBIDDEN_NON_LIBRARY_TAGS.includes(tag))) {
    return { kind: 'invalidNonLibraryTag' };
  }
  if (listType === 'series-tracker' && (!tags.includes(SERIES_TAG) || tags.includes(MOVIE_TAG))) {
    return { kind: 'invalidSeriesTrackerTags' };
  }
  if (listType === 'movie-tracker' && (!tags.includes(MOVIE_TAG) || tags.includes(SERIES_TAG))) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  return undefined;
};

export const changeCollectionItemTagValidation = ({
  tags,
  listType,
  existingListType,
  requesterIsOwner,
}: CollectionItemChangeTagValidationInput): CollectionItemTagValidationError | undefined => {
  if (existingListType !== 'library' && !requesterIsOwner) {
    return { kind: 'sharedInternalCollectionItemUpdate' };
  }
  const tagValidation = collectionItemTagValidation(tags);
  if (tagValidation) return tagValidation;
  if (existingListType !== 'library' && listType !== 'series-tracker' && listType !== 'movie-tracker') {
    return { kind: 'invalidInternalCollectionItemUpdate' };
  }
  if (
    listType === 'series-tracker' &&
    (!tags.includes(SERIES_TAG) ||
      tags.includes(MOVIE_TAG) ||
      tags.some((tag) => FORBIDDEN_NON_LIBRARY_TAGS.includes(tag)))
  ) {
    return { kind: 'invalidSeriesTrackerTags' };
  }
  if (
    listType === 'movie-tracker' &&
    (!tags.includes(MOVIE_TAG) ||
      tags.includes(SERIES_TAG) ||
      tags.some((tag) => FORBIDDEN_NON_LIBRARY_TAGS.includes(tag)))
  ) {
    return { kind: 'invalidInternalCollectionTag' };
  }
  return undefined;
};

export const filterEditableTags = (tags: readonly string[]): string[] =>
  tags.filter((tag) => !EDITOR_HIDDEN_TAGS.includes(tag));

export const filterEditorPreservedTags = (tags: readonly string[]): string[] =>
  tags.filter((tag) => EDITOR_PRESERVED_TAGS.includes(tag));

export const filterDisplayTags = (tags: readonly string[]): string[] =>
  tags.filter((tag) => !INTERNAL_COLLECTION_TAGS.includes(tag));
