import {
  buildEpisodeProgressTag as buildSharedEpisodeProgressTag,
  filterEditableTags as filterSharedEditableTags,
  forbiddenInternalTagTextValidation,
  invalidInternalCollectionTagValidation as sharedInvalidInternalCollectionTagValidation,
  parseEpisodeProgress as parseSharedEpisodeProgress,
  removeEpisodeProgressTags as removeSharedEpisodeProgressTags,
  typeTagValidation as sharedTypeTagValidation,
  virtualTagValidation as sharedVirtualTagValidation,
} from '@shared/utils/collection-item-tag-validation-util';

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
  const error = forbiddenInternalTagTextValidation(tagText);
  return error?.kind === 'usedInternalTag' ? error : undefined;
};

export const virtualTagValidation = (tags: readonly string[]): VirtualTagValidationError | undefined => {
  const error = sharedVirtualTagValidation(tags);
  return error?.kind === 'virtualTag' ? error : undefined;
};

export const invalidInternalCollectionTagValidation = (
  tags: readonly string[]
): InvalidInternalCollectionTagValidationError | undefined => {
  const error = sharedInvalidInternalCollectionTagValidation(tags);
  return error?.kind === 'invalidInternalCollectionTag' ? error : undefined;
};

export const typeTagValidation = (tags: readonly string[]): MissingTypeTagValidationError | undefined => {
  const error = sharedTypeTagValidation(tags);
  return error?.kind === 'missingTypeTag' ? error : undefined;
};

export const removeEpisodeProgressTags = removeSharedEpisodeProgressTags;
export const filterEditableTags = filterSharedEditableTags;
export const buildEpisodeProgressTag = buildSharedEpisodeProgressTag;
export const parseEpisodeProgress = parseSharedEpisodeProgress;
