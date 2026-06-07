import {
  FAVORITE_TAG,
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  WATCHED_TAG,
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
const FORBIDDEN_NON_LIBRARY_TAGS = [FAVORITE_TAG, WATCHED_TAG];
const EPISODE_PROGRESS_TAG_PATTERN = /^#episode-s(\d{2})e(\d{2})$/;

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
  return virtualTagValidation(tags) ?? invalidInternalCollectionTagValidation(tags) ?? typeTagValidation(tags);
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
  if (existingListType !== 'library' && listType !== 'series-tracker') {
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
  return undefined;
};

export const removeEpisodeProgressTags = (tags: readonly string[]): string[] =>
  tags.filter((tag) => !EPISODE_PROGRESS_TAG_PATTERN.test(tag));

export const filterEditableTags = (tags: readonly string[]): string[] =>
  removeEpisodeProgressTags(tags).filter((tag) => !INTERNAL_COLLECTION_TAGS.includes(tag));

export const buildEpisodeProgressTag = (season: number, episode: number): string =>
  `#episode-s${`${season}`.padStart(2, '0')}e${`${episode}`.padStart(2, '0')}`;

export const parseEpisodeProgress = (tags: readonly string[]): { season: number; episode: number } | null => {
  const progressTag = tags.find((tag) => EPISODE_PROGRESS_TAG_PATTERN.test(tag));
  const match = progressTag?.match(EPISODE_PROGRESS_TAG_PATTERN);
  if (!match) return null;
  return { season: Number(match[1]), episode: Number(match[2]) };
};
