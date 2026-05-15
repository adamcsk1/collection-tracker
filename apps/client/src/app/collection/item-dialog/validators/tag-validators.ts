import { MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS, WATCH_LATER_TAG, WISHLIST_TAG } from '@shared/constants/tags-const';

export type VirtualTagValidationError = {
  kind: 'virtualTag';
};

export type InvalidInternalCollectionTagValidationError = {
  kind: 'invalidInternalCollectionTag';
};

export type MissingTypeTagValidationError = {
  kind: 'missingTypeTag';
};

export const virtualTagValidation = (tags: readonly string[]): VirtualTagValidationError | undefined => {
  return tags.some((tag) => VIRTUAL_TAGS.includes(tag)) ? { kind: 'virtualTag' } : undefined;
};

export const invalidInternalCollectionTagValidation = (
  tags: readonly string[]
): InvalidInternalCollectionTagValidationError | undefined => {
  const internalCollectionTags = [WATCH_LATER_TAG, WISHLIST_TAG];
  return tags.some((tag) => internalCollectionTags.includes(tag))
    ? { kind: 'invalidInternalCollectionTag' }
    : undefined;
};

export const typeTagValidation = (tags: readonly string[]): MissingTypeTagValidationError | undefined => {
  return tags.some((tag) => tag === MOVIE_TAG || tag === SERIES_TAG) ? undefined : { kind: 'missingTypeTag' };
};
