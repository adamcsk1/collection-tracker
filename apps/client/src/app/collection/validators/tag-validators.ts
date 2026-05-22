import {
  INTERNAL_USED_TAGS,
  MOVIE_TAG,
  SERIES_TAG,
  VIRTUAL_TAGS,
  WATCH_LATER_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import { parseTagText } from '@shared/utils/collection-item-text-util';

const INTERNAL_COLLECTION_TAGS = [WATCH_LATER_TAG, WISHLIST_TAG];
const TYPE_TAGS = [MOVIE_TAG, SERIES_TAG];
const EPISODE_PROGRESS_TAG_PATTERN = /^#episode-s(\d{2})e(\d{2})$/;

export type ForbiddenInternalTagValidationError = {
  kind: 'usedInternalTag';
};

export type VirtualTagValidationError = {
  kind: 'virtualTag';
};

export type InvalidInternalCollectionTagValidationError = {
  kind: 'invalidInternalCollectionTag';
};

export type MissingTypeTagValidationError = {
  kind: 'missingTypeTag';
};

export const forbiddenInternalTagValidation = (
  tagText: string | null
): ForbiddenInternalTagValidationError | undefined => {
  const tags = parseTagText(tagText ?? '');
  return tags.some((tag) => VIRTUAL_TAGS.includes(tag) || INTERNAL_USED_TAGS.includes(tag))
    ? { kind: 'usedInternalTag' }
    : undefined;
};

export const virtualTagValidation = (tags: readonly string[]): VirtualTagValidationError | undefined => {
  return tags.some((tag) => VIRTUAL_TAGS.includes(tag)) ? { kind: 'virtualTag' } : undefined;
};

export const invalidInternalCollectionTagValidation = (
  tags: readonly string[]
): InvalidInternalCollectionTagValidationError | undefined => {
  return tags.some((tag) => INTERNAL_COLLECTION_TAGS.includes(tag))
    ? { kind: 'invalidInternalCollectionTag' }
    : undefined;
};

export const typeTagValidation = (tags: readonly string[]): MissingTypeTagValidationError | undefined => {
  return tags.some((tag) => TYPE_TAGS.includes(tag)) ? undefined : { kind: 'missingTypeTag' };
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
